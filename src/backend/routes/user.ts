import { Router } from "express";
import { db } from "../../db/index.ts";
import { users, chatMessages } from "../../db/schema.ts";
import { eq } from "drizzle-orm";
import { Server } from "socket.io";

export const createProxyRouter = (getIo: () => Server | null) => {
  const router = Router();

  // Progress route
  router.get("/progress", (req, res) => {
    res.json({
      level: "Intermediate",
      isPro: false,
      dailyProgress: [
        { date: "2024-02-15", score: 65 },
        { date: "2024-02-16", score: 72 },
        { date: "2024-02-17", score: 68 },
        { date: "2024-02-18", score: 85 },
        { date: "2024-02-19", score: 78 },
        { date: "2024-02-20", score: 90 },
        { date: "2024-02-21", score: 88 },
      ],
      tasksCompleted: 12,
      totalTasks: 20
    });
  });

  // Sync user details
  router.post("/sync", async (req, res) => {
    const { email, name, mobile, onboarding, progress, isPro } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    try {
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (existingUser.length === 0) {
        // Insert new user
        await db.insert(users).values({
          email,
          name: name || email.split("@")[0],
          mobile: mobile || null,
          onboarding_json: onboarding ? JSON.stringify(onboarding) : null,
          progress_json: progress ? JSON.stringify(progress) : null,
          is_pro: isPro ? 1 : 0,
        });
      } else {
        // Update user
        const updateParams: Partial<typeof users.$inferInsert> = {};
        if (name) updateParams.name = name;
        if (mobile) updateParams.mobile = mobile;
        if (onboarding) updateParams.onboarding_json = JSON.stringify(onboarding);
        if (progress) updateParams.progress_json = JSON.stringify(progress);
        if (isPro !== undefined) updateParams.is_pro = isPro ? 1 : 0;

        if (Object.keys(updateParams).length > 0) {
          await db.update(users).set(updateParams).where(eq(users.email, email));
        }
      }

      const [updatedUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const userData = {
        ...updatedUser,
        onboarding: updatedUser.onboarding_json ? JSON.parse(updatedUser.onboarding_json) : null,
        progress: updatedUser.progress_json ? JSON.parse(updatedUser.progress_json) : null,
      };

      // Emit socket.io real-time update
      const io = getIo();
      if (io) {
        io.emit("user:registered", userData);
      }

      res.json(userData);
    } catch (err: any) {
      console.error("Sync user error:", err);
      res.status(500).json({ error: "Failed to sync user" });
    }
  });

  // Get user details
  router.get("/:email", async (req, res) => {
    try {
      const existingUser = await db.select().from(users).where(eq(users.email, req.params.email)).limit(1);
      if (existingUser.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = existingUser[0];
      res.json({
        ...user,
        onboarding: user.onboarding_json ? JSON.parse(user.onboarding_json) : null,
        progress: user.progress_json ? JSON.parse(user.progress_json) : null,
      });
    } catch (err: any) {
      console.error("Get user error:", err);
      res.status(500).json({ error: "Failed to retrieve user" });
    }
  });

  // Delete account with notification simulation
  router.post("/delete-account", async (req, res) => {
    const { email, mobile } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      const existingUserResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const user = existingUserResult[0];

      await db.delete(chatMessages).where(eq(chatMessages.user_email, email));
      await db.delete(users).where(eq(users.email, email));

      const message = `Your HumnAi account (${email}) has been successfully deleted. We're sorry to see you go!`;
      console.log(`[NOTIFICATION] Sending Email to ${email}: ${message}`);
      if (mobile || user?.mobile) {
        console.log(`[NOTIFICATION] Sending SMS to ${mobile || user?.mobile}: ${message}`);
      }

      res.json({ success: true, message: "Account deleted and notifications sent." });
    } catch (error: any) {
      console.error("Delete account error:", error);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // Upgrade demo route
  router.post("/upgrade-demo", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    try {
      const existingUserResult = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUserResult.length > 0) {
        await db.update(users).set({ is_pro: 1 }).where(eq(users.email, email));
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Failed to upgrade demo user" });
    }
  });

  return router;
};

export const createChatRouter = () => {
  const router = Router();

  // Get chat history for user
  router.get("/:email", async (req, res) => {
    try {
      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.user_email, req.params.email))
        .orderBy(chatMessages.timestamp);

      res.json(messages);
    } catch (err: any) {
      console.error("Retrieve chat history error:", err);
      res.status(500).json({ error: "Failed to fetch chat history" });
    }
  });

  // Send/log chat message
  router.post("/message", async (req, res) => {
    const { email, role, text, correction, translation, explanation } = req.body;
    if (!email || !role || !text) {
      return res.status(400).json({ error: "Missing required chat fields" });
    }

    try {
      await db.insert(chatMessages).values({
        user_email: email,
        role,
        text,
        correction: correction || null,
        translation: translation || null,
        explanation: explanation || null,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Save chat message error:", error);
      res.status(500).json({ error: "Failed to save message" });
    }
  });

  return router;
};
