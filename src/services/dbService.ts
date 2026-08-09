export interface UserData {
  email: string;
  name?: string;
  mobile?: string;
  onboarding?: any;
  progress?: any;
  isPro?: boolean;
}

export const dbService = {
  async syncUser(data: UserData) {
    try {
      const response = await fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn("Backend API /api/user/sync unavailable, using LocalStorage fallback.");
    }

    // Fallback: LocalStorage Persistence
    if (typeof window !== 'undefined' && data.email) {
      try {
        localStorage.setItem(`humnai_user_data_${data.email}`, JSON.stringify(data));
      } catch (e) {}
    }
    return { success: true, local: true, user: data };
  },

  async getUser(email: string) {
    try {
      const response = await fetch(`/api/user/${email}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn(`Backend API /api/user/${email} unavailable, using LocalStorage fallback.`);
    }

    // Fallback: LocalStorage Reader
    if (typeof window !== 'undefined' && email) {
      try {
        const local = localStorage.getItem(`humnai_user_data_${email}`);
        if (local) return JSON.parse(local);
      } catch (e) {}
    }
    return null;
  },

  async getChatHistory(email: string) {
    try {
      const response = await fetch(`/api/chat/${email}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn(`Backend API /api/chat/${email} unavailable, using LocalStorage fallback.`);
    }

    // Fallback: LocalStorage Chat Reader
    if (typeof window !== 'undefined' && email) {
      try {
        const local = localStorage.getItem(`humnai_chat_${email}`);
        if (local) {
          const parsed = JSON.parse(local);
          return parsed.messages || [];
        }
      } catch (e) {}
    }
    return [];
  },

  async saveChatMessage(
    email: string, 
    message: { role: string; text: string; correction?: string; translation?: string; explanation?: string }
  ) {
    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...message }),
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn("Backend API /api/chat/message unavailable, saving to LocalStorage.");
    }

    // Fallback: LocalStorage Chat Writer
    if (typeof window !== 'undefined' && email) {
      try {
        const storageKey = `humnai_chat_${email}`;
        const existing = localStorage.getItem(storageKey);
        let messages: any[] = [];
        if (existing) {
          const parsed = JSON.parse(existing);
          messages = parsed.messages || [];
        }
        messages.push({
          id: Date.now().toString(),
          ...message,
          timestamp: Date.now()
        });
        localStorage.setItem(storageKey, JSON.stringify({
          messages,
          timestamp: Date.now()
        }));
      } catch (e) {}
    }
    return { success: true, local: true };
  }
};
