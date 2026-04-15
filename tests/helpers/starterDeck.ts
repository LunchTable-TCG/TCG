import { starterFormat } from "@lunchtable/card-content";

export function buildStarterDeck() {
  return {
    mainboard: starterFormat.cardPool.map((card) => ({
      cardId: card.id,
      count: starterFormat.deckRules.maxCopies,
    })),
    sideboard: [],
  };
}
