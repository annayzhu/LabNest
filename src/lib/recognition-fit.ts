/**
 * Services that fell below the bar for organizing manuals (Q299: located numbers 100 % right, step recall ≥ 90 %,
 * unverified lines ≤ 10 %), with what the evaluation saw. They stay usable; the AI page and the recognition page say so.
 */
const notRecommended: Record<string, string> = {
  // 2026-11-01 evaluation: it read the lentivirus manual correctly but refused to write its steps (recall 0 %).
  chatgpt_subscription: "In the evaluation it refused to write a lentivirus manual’s steps and gave only an outline.",
};

/** Why a service of this type is not recommended for organizing manuals, if it is not. */
export function recognitionWarning(providerType: string | null | undefined) {
  return providerType ? notRecommended[providerType] : undefined;
}
