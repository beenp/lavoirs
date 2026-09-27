import type { Group } from "./Group";

/** Small adapter boundary so the generator can work with any LLM provider. */
export interface TextGenerationClient {
  generateText(input: {
    systemPrompt: string;
    userPrompt: string;
  }): Promise<string>;
}

/** A generated conversation starter for a group session. */
export interface IcebreakerPrompt {
  text: string;
  interestsUsed: string[];
  generatedAt: Date;
}

/** Creates one group icebreaker from the interests members chose this session. */
export class IcebreakerGenerator {
  constructor(private readonly llm: TextGenerationClient) {}

  async generate(group: Group): Promise<IcebreakerPrompt> {
    if (group.members.length < 2) {
      throw new Error("An icebreaker needs at least two group members");
    }

    const interestsUsed = this.selectInterests(group);
    let text: string | undefined;
    try {
      const raw = await this.llm.generateText({
        systemPrompt: [
          "You will write welcoming icebreaker questions (not boring clicbe ones) for a small online group of adults.",
          "Return exactly one question, with no heading, numbering, quotation marks, or explanation.",
          "Make it low-pressure, open-ended, something that is easy to bait into engagement, easy for everyone to answer, and more specific to the supplied interests.",
          "Do not assume a member's identity, experience, ability, beliefs, or level of expertise.",
          "Avoid asking for sensitive personal information or requiring anyone to spend money.",
          "Keep it to one or two short sentences.",
        ].join(" "),
        userPrompt: [
          `Group size: ${group.members.length}`,
          `Interests selected for this session: ${interestsUsed.join(", ")}`,
          "Write one question that lets people connect these interests to their own background or values, story, opinion, or fun hypothetical.",
        ].join("\n"),
      });
      text = this.cleanAndValidate(raw);
    } catch {
      // The session can still start if the model provider is temporarily down.
    }

    return {
      text: text ?? this.createFallback(interestsUsed),
      interestsUsed,
      generatedAt: new Date(),
    };
  }

  /** Picks group-wide interests when possible, otherwise the most common ones. */
  private selectInterests(group: Group): string[] {
    if (group.sharedInterests.length > 0) return group.sharedInterests.slice(0, 3);

    const counts = new Map<string, number>();
    for (const member of group.members) {
      for (const interest of new Set(member.interests)) {
        const normalized = interest.trim();
        if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort(([interestA, countA], [interestB, countB]) => countB - countA || interestA.localeCompare(interestB))
      .slice(0, 3)
      .map(([interest]) => interest);
  }

  private cleanAndValidate(raw: string): string | undefined {
    const text = raw.trim().replace(/^[-*\d.)\s]+/, "").replace(/^['"“”]+|['"“”]+$/g, "");
    if (!text || text.length > 400 || !text.includes("?")) return undefined;
    return text;
  }

  private createFallback(interests: string[]): string {
    if (interests.length === 0) {
      return "What is something small that has made you curious lately?";
    }
    if (interests.length === 1) {
      return `What first got you interested in ${interests[0]}, or what do you enjoy about it now?`;
    }
    return `Which of these interests would you most like to share with someone new, and what would you show them first: ${interests.join(", ")}?`;
  }
}
