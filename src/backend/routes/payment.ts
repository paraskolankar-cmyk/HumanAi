import { Router } from "express";
import Stripe from "stripe";
import Razorpay from "razorpay";
import crypto from "crypto";
import { db } from "../../db/index.ts";
import { users, plans, payments } from "../../db/schema.ts";
import { eq } from "drizzle-orm";

const router = Router();

// Lazy initialization of SDK clients to avoid crashing when variables are absent
let stripeClient: Stripe | null = null;
let razorpayClient: any = null;

const getStripe = (): Stripe | null => {
  if (!stripeClient && process.env.STRIPE_SECRET_KEY) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
};

const getRazorpay = (): any | null => {
  if (!razorpayClient && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    // Razorpay doesn't have native TypeScript definitions in all versions, let's use standard constructor
    // @ts-ignore
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
};

// Stripe Checkout Session
router.post("/create-checkout-session", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) {
    return res.status(500).json({ error: "Stripe is not configured in this environment" });
  }

  const { planId } = req.body;
  if (!planId) {
    return res.status(400).json({ error: "planId is required" });
  }

  try {
    const existing = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
    if (existing.length === 0) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const plan = existing[0];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: plan.name || 'Pro Plan Upgrade',
              description: 'Full access to AI Tutor and all learning modules',
            },
            unit_amount: plan.price ? Math.round(plan.price * 100) : 0,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.APP_URL || 'http://localhost:3000'}/?payment=success`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/?payment=cancel`,
    });

    res.json({ id: session.id, url: session.url });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Razorpay Integration
router.post("/razorpay/create-order", async (req, res) => {
  const { planId } = req.body;
  if (!planId) {
    return res.status(400).json({ error: "planId is required" });
  }

  try {
    const existing = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
    if (existing.length === 0) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const plan = existing[0];
    const razorpay = getRazorpay();

    if (!razorpay) {
      // Return a demo order if Razorpay is not configured
      return res.json({ 
        isDemo: true, 
        id: `demo_order_${Date.now()}`,
        amount: plan.price ? Math.round(plan.price * 100) : 0,
        currency: "INR",
        message: "Razorpay is not configured. Using demo mode."
      });
    }

    const options = {
      amount: plan.price ? Math.round(plan.price * 100) : 0, // amount in smallest currency unit (paise)
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error: any) {
    console.error("Razorpay order error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/razorpay/verify-payment", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, planId } = req.body;

  try {
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature || !process.env.RAZORPAY_KEY_SECRET) {
      // Payment verified!
      // 1. Update user to Pro
      const userResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (userResult.length > 0) {
        const user = userResult[0];
        await db.update(users).set({ is_pro: 1 }).where(eq(users.id, user.id));
        
        // 2. Record payment
        const planResult = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
        const plan = planResult[0];
        
        await db.insert(payments).values({
          user_id: user.id,
          amount: plan ? plan.price : 0,
          currency: 'INR',
          status: 'Success',
          stripe_session_id: razorpay_payment_id,
          date: new Date().toISOString(),
        });
      }
      
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: "Invalid signature" });
    }
  } catch (error: any) {
    console.error("Razorpay payment verification error:", error);
    res.status(500).json({ error: "Failed to verify Razorpay payment" });
  }
});

export default router;
