import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../../common/firebase/firebase.service';
import {
  ConversationState,
  ConversationStatus,
  QuotationDraft,
  TelegramConfig,
} from '../interfaces/quotation-draft.interface';

const CONVERSATION_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Manages conversational state for each Telegram chat.
 * States are persisted in Firestore collection `telegram_conversations`.
 */
@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(private firebase: FirebaseService) {}

  // ─── Telegram Config ──────────────────────────────────────────────

  async getConfig(): Promise<TelegramConfig> {
    const doc = await this.firebase.db.collection('config').doc('telegram').get();
    if (!doc.exists) {
      return { enabled: false, authorizedChatIds: {}, maxQuotationsPerHour: 10 };
    }
    return doc.data() as TelegramConfig;
  }

  async saveConfig(config: TelegramConfig): Promise<void> {
    await this.firebase.db.collection('config').doc('telegram').set(config, { merge: true });
  }

  /**
   * Checks if the given chatId is authorized. Returns the linked Firebase UID or null.
   */
  async getLinkedUserId(chatId: number): Promise<string | null> {
    const config = await this.getConfig();
    if (!config.enabled) return null;
    return config.authorizedChatIds[String(chatId)] || null;
  }

  // ─── Conversation State ───────────────────────────────────────────

  private convCol() {
    return this.firebase.db.collection('telegram_conversations');
  }

  async getState(chatId: number): Promise<ConversationState | null> {
    const doc = await this.convCol().doc(String(chatId)).get();
    if (!doc.exists) return null;

    const state = doc.data() as ConversationState;

    // Check TTL
    const lastActivity = state.lastActivity instanceof Date
      ? state.lastActivity
      : new Date(state.lastActivity);

    if (Date.now() - lastActivity.getTime() > CONVERSATION_TTL_MS) {
      this.logger.log(`Conversation ${chatId} expired, resetting`);
      await this.resetState(chatId);
      return null;
    }

    return state;
  }

  async setState(chatId: number, state: ConversationState): Promise<void> {
    // Firestore does not accept `undefined` values — replace with null.
    const sanitized = JSON.parse(JSON.stringify(state, (_key, val) =>
      val === undefined ? null : val,
    ));
    await this.convCol().doc(String(chatId)).set({
      ...sanitized,
      lastActivity: new Date(),
    });
  }

  async updateDraft(
    chatId: number,
    draft: Partial<QuotationDraft>,
    status: ConversationStatus,
    missingFields: string[],
  ): Promise<void> {
    const current = await this.getState(chatId);
    if (!current) return;

    await this.setState(chatId, {
      ...current,
      status,
      draft: { ...current.draft, ...draft },
      missingFields,
    });
  }

  async resetState(chatId: number): Promise<void> {
    await this.convCol().doc(String(chatId)).delete();
  }

  // ─── Company/Contact resolution ───────────────────────────────────

  /**
   * Loads all active companies as a simple list for the Gemini prompt.
   * Format: "- CompanyName (RUC: xxx)"
   */
  async getCompaniesListForPrompt(): Promise<string> {
    const snap = await this.firebase.db
      .collection('companies')
      .where('isActive', '==', true)
      .get();

    if (snap.empty) return '(No hay empresas registradas)';

    return snap.docs
      .map((d) => {
        const data = d.data();
        const name = data.tradeName || data.businessName || '(sin nombre)';
        const ruc = data.ruc ? ` (RUC: ${data.ruc})` : '';
        return `- ${name}${ruc}`;
      })
      .join('\n');
  }

  /**
   * Fuzzy-match a company name from Gemini against Firestore companies.
   * Returns { id, tradeName } or null.
   */
  async resolveCompany(
    companyName: string,
  ): Promise<{ id: string; tradeName: string } | null> {
    if (!companyName?.trim()) return null;

    const snap = await this.firebase.db
      .collection('companies')
      .where('isActive', '==', true)
      .get();

    const needle = companyName.toLowerCase().trim();
    let bestMatch: { id: string; tradeName: string; score: number } | null = null;

    for (const doc of snap.docs) {
      const data = doc.data();
      const candidates = [
        data.tradeName?.toLowerCase() || '',
        data.businessName?.toLowerCase() || '',
      ];

      for (const candidate of candidates) {
        if (!candidate) continue;
        const score = this.similarityScore(needle, candidate);
        if (score > 0.4 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = {
            id: doc.id,
            tradeName: data.tradeName || data.businessName,
            score,
          };
        }
      }
    }

    if (bestMatch) {
      this.logger.log(
        `Resolved company "${companyName}" → "${bestMatch.tradeName}" (score: ${bestMatch.score.toFixed(2)})`,
      );
    }

    return bestMatch ? { id: bestMatch.id, tradeName: bestMatch.tradeName } : null;
  }

  /**
   * Resolve a contact name within a company.
   */
  async resolveContact(
    contactName: string,
    companyId: string,
  ): Promise<{ id: string; fullName: string } | null> {
    if (!contactName?.trim() || !companyId) return null;

    const snap = await this.firebase.db
      .collection('contacts')
      .where('companyId', '==', companyId)
      .get();

    const needle = contactName.toLowerCase().trim();
    let bestMatch: { id: string; fullName: string; score: number } | null = null;

    for (const doc of snap.docs) {
      const data = doc.data();
      const fullName = (data.fullName || '').toLowerCase();
      const score = this.similarityScore(needle, fullName);
      if (score > 0.4 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { id: doc.id, fullName: data.fullName, score };
      }
    }

    return bestMatch ? { id: bestMatch.id, fullName: bestMatch.fullName } : null;
  }

  /**
   * Simple similarity score based on common substring ratio.
   * Returns 0..1 (1 = identical).
   */
  private similarityScore(a: string, b: string): number {
    if (a === b) return 1;
    if (!a || !b) return 0;

    // Check if one contains the other
    if (b.includes(a) || a.includes(b)) {
      return Math.min(a.length, b.length) / Math.max(a.length, b.length);
    }

    // Bigram similarity (Dice coefficient)
    const bigrams = (s: string) => {
      const set = new Set<string>();
      for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
      return set;
    };

    const aBigrams = bigrams(a);
    const bBigrams = bigrams(b);
    let intersection = 0;
    for (const bg of aBigrams) {
      if (bBigrams.has(bg)) intersection++;
    }

    return (2 * intersection) / (aBigrams.size + bBigrams.size);
  }
}
