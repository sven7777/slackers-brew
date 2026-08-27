// Persistence keys are internal names; these are what a brewer would call them.
// Shared by the two banners that name a key on screen (SaveErrorBanner,
// StaleDataBanner) so "recipes" never reads as "Recipes" in one and "recipes"
// in the other.

const LABELS = {
  malts: "Malt inventory",
  hops: "Hop inventory",
  yeast: "Yeast inventory",
  adj: "Adjunct inventory",
  recipes: "Recipes",
  orders: "Order selection",
  settings: "Settings",
  selR: "Selected recipe",
  tab: "Selected tab",
};

export const labelFor = (key) => LABELS[key] ?? key;

// "Recipes and Malt inventory", for a banner naming several at once.
export const labelList = (keys = []) => {
  const names = keys.map(labelFor);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};
