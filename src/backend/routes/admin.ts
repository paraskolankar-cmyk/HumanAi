import { Router } from "express";
import { db } from "../../db/index.ts";
import { 
  users, 
  plans, 
  modules, 
  lessons, 
  assessmentQuestions, 
  payments 
} from "../../db/schema.ts";
import { eq, desc, sum } from "drizzle-orm";

const router = Router();

// ==========================================
// PUBLIC DATABASE ENDPOINTS
// ==========================================

// Get plans
router.get("/plans", async (req, res) => {
  try {
    const allPlans = await db.select().from(plans);
    res.json(allPlans);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to retrieve plans" });
  }
});

// Get modules
router.get("/modules", async (req, res) => {
  try {
    const allModules = await db.select().from(modules);
    res.json(allModules);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to retrieve modules" });
  }
});

// Get lessons for a module
router.get("/modules/:id/lessons", async (req, res) => {
  try {
    const allLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.module_id, req.params.id));

    res.json(allLessons.map((l) => {
      let content = [];
      try {
        if (l.content_json) {
          content = JSON.parse(l.content_json);
        }
      } catch (err) {
        console.error(`Invalid JSON in lesson content for ${l.id}:`, err);
      }
      return { 
        ...l, 
        content 
      };
    }));
  } catch (error: any) {
    res.status(500).json({ error: "Failed to retrieve lessons" });
  }
});

// Get assessment questions
router.get("/assessment-questions", async (req, res) => {
  try {
    const questions = await db.select().from(assessmentQuestions);
    res.json(questions.map((q) => {
      let options = [];
      try {
        if (q.options_json) {
          options = JSON.parse(q.options_json);
        }
      } catch (err) {
        console.error(`Invalid JSON in assessment question options for ${q.id}:`, err);
      }
      return { 
        ...q, 
        options 
      };
    }));
  } catch (error: any) {
    res.status(500).json({ error: "Failed to retrieve assessment questions" });
  }
});


// ==========================================
// ADMIN WORKFLOWS
// ==========================================

// Get all users in dashboard
router.get("/admin/users", async (req, res) => {
  try {
    const allUsers = await db.select().from(users).orderBy(desc(users.id));
    const formatted = allUsers.map((user) => {
      let onboarding = null;
      let progress = null;
      try {
        if (user.onboarding_json) {
          onboarding = JSON.parse(user.onboarding_json);
        }
      } catch (err) {
        console.error(`Invalid onboarding JSON for user ${user.id}:`, err);
      }
      try {
        if (user.progress_json) {
          progress = JSON.parse(user.progress_json);
        }
      } catch (err) {
        console.error(`Invalid progress JSON for user ${user.id}:`, err);
      }
      return {
        ...user,
        onboarding,
        progress
      };
    });
    res.json(formatted);
  } catch (error: any) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Update pro member status
router.post("/admin/users/update-pro", async (req, res) => {
  const { id, is_pro } = req.body;
  try {
    await db.update(users).set({ is_pro: is_pro ? 1 : 0 }).where(eq(users.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update pro status" });
  }
});

// Update admin member status
router.post("/admin/users/update-admin", async (req, res) => {
  const { id, is_admin } = req.body;
  try {
    await db.update(users).set({ is_admin: is_admin ? 1 : 0 }).where(eq(users.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update admin status" });
  }
});

// Update full user profile
router.post("/admin/users/update", async (req, res) => {
  const { id, name, email, mobile, level, is_pro, is_admin } = req.body;
  try {
    await db.update(users).set({
      name,
      email,
      mobile,
      level,
      is_pro: is_pro !== undefined ? (is_pro ? 1 : 0) : 0,
      is_admin: is_admin !== undefined ? (is_admin ? 1 : 0) : 0,
    }).where(eq(users.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update user profile" });
  }
});

// Delete user account
router.post("/admin/users/delete", async (req, res) => {
  const { id } = req.body;
  try {
    await db.delete(users).where(eq(users.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// Plans CRUD
router.post("/admin/plans/create", async (req, res) => {
  const { id, name, price, interval } = req.body;
  try {
    await db.insert(plans).values({ id, name, price: parseFloat(price), interval });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create plan" });
  }
});

router.post("/admin/plans/update", async (req, res) => {
  const { id, name, price, interval } = req.body;
  if (!id) return res.status(400).json({ error: "Missing plan id" });
  try {
    const existing = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
    if (existing.length === 0) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const plan = existing[0];
    const finalName = name !== undefined ? name : plan.name;
    const finalPrice = price !== undefined ? parseFloat(price) : plan.price;
    const finalInterval = interval !== undefined ? interval : plan.interval;

    await db.update(plans).set({
      name: finalName,
      price: finalPrice,
      interval: finalInterval
    }).where(eq(plans.id, id));

    res.json({ success: true, plan: { id, name: finalName, price: finalPrice, interval: finalInterval } });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update plan" });
  }
});

router.post("/admin/plans/delete", async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Missing plan id" });
  try {
    await db.delete(plans).where(eq(plans.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete plan" });
  }
});

// Modules CRUD
router.post("/admin/modules/create", async (req, res) => {
  const { id, title, description } = req.body;
  try {
    await db.insert(modules).values({
      id,
      title,
      description,
      icon: 'Book',
      color: 'bg-blue-50 text-blue-600',
      count: '0 Lessons'
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create module" });
  }
});

router.post("/admin/modules/update", async (req, res) => {
  const { id, title, description } = req.body;
  try {
    await db.update(modules).set({ title, description }).where(eq(modules.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update module" });
  }
});

router.post("/admin/modules/delete", async (req, res) => {
  const { id } = req.body;
  try {
    // Cascade lessons delete is handled by postgres schema cascade, but let's delete lessons explicitly too for clarity
    await db.delete(lessons).where(eq(lessons.module_id, id));
    await db.delete(modules).where(eq(modules.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete module" });
  }
});

// Lessons CRUD
router.post("/admin/lessons/create", async (req, res) => {
  const { id, moduleId, title, duration, content } = req.body;
  try {
    await db.insert(lessons).values({
      id,
      module_id: moduleId,
      title,
      duration,
      content_json: JSON.stringify(content)
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create lesson" });
  }
});

router.post("/admin/lessons/update", async (req, res) => {
  const { id, title, duration, content } = req.body;
  try {
    await db.update(lessons).set({
      title,
      duration,
      content_json: JSON.stringify(content)
    }).where(eq(lessons.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update lesson" });
  }
});

router.post("/admin/lessons/delete", async (req, res) => {
  const { id } = req.body;
  try {
    await db.delete(lessons).where(eq(lessons.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete lesson" });
  }
});

// Assessment Questions CRUD
router.post("/admin/assessment-questions/create", async (req, res) => {
  const { question, options, answer } = req.body;
  try {
    await db.insert(assessmentQuestions).values({
      question,
      options_json: JSON.stringify(options),
      answer
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create assessment question" });
  }
});

router.post("/admin/assessment-questions/update", async (req, res) => {
  const { id, question, options, answer } = req.body;
  try {
    await db.update(assessmentQuestions).set({
      question,
      options_json: JSON.stringify(options),
      answer
    }).where(eq(assessmentQuestions.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update assessment question" });
  }
});

router.post("/admin/assessment-questions/delete", async (req, res) => {
  const { id } = req.body;
  try {
    await db.delete(assessmentQuestions).where(eq(assessmentQuestions.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to delete assessment question" });
  }
});

// Admin stats calculation
router.get("/admin/stats", async (req, res) => {
  try {
    // 1. Get counts from tables
    const userCountResult = await db.select().from(users);
    const totalUsers = userCountResult.length;

    const proUsersResult = await db.select().from(users).where(eq(users.is_pro, 1));
    const proUsers = proUsersResult.length;

    // 2. Sum of revenue
    const revenueResult = await db
      .select({ total: sum(payments.amount) })
      .from(payments)
      .where(eq(payments.status, 'Success'));
    const revenue = parseFloat(revenueResult[0]?.total || "0");

    // 3. Recent payments joined with users
    // Let's perform a left join with users
    const recentPaymentsRaw = await db
      .select({
        payment: payments,
        user: users
      })
      .from(payments)
      .leftJoin(users, eq(payments.user_id, users.id))
      .orderBy(desc(payments.id))
      .limit(5);

    const recentPayments = recentPaymentsRaw.map(({ payment, user }) => ({
      id: payment.id,
      user: user?.name || 'Anonymous',
      amount: payment.amount,
      status: payment.status,
      date: payment.date,
      plan: payment.amount && payment.amount > 1000 ? 'Yearly' : 'Monthly'
    }));

    res.json({
      totalUsers,
      proUsers,
      revenue,
      recentPayments,
      userGrowth: [
        { month: 'Jan', users: Math.floor(totalUsers * 0.6) },
        { month: 'Feb', users: totalUsers },
      ]
    });
  } catch (error: any) {
    console.error("Admin stats fetch failure:", error);
    res.status(500).json({ error: "Failed to calculate admin stats" });
  }
});

export default router;
