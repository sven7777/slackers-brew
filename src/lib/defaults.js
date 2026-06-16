// Default ingredient catalogs and preset recipes. These seed the app on first
// run; afterwards state is loaded from localStorage (see lib/storage.js).

export const defMalts = [
  ["Pils",0],["2-Row",0],["Maris Otter",0],["Caramunich I",0],
  ["Carafoam",0],["Chocolate",0],["Black Patent",0],["Roasted Barley",0],
  ["White Wheat",0],["Aromatic",0],["Flaked Wheat",0],["Flaked Corn",0],
  ["Vienna",0],["Munich",0],["Carafe III",0],["Biscuit Malt",0],
  ["Crystal 80",0],["Flaked Oat",0],["Midnight Wheat",0]
];
export const defHops = [
  ["Pink Boots 2025",0],["Saaz",0],["CTZ",0],["Willamette",0],
  ["Amarillo",0],["Simcoe",0],["Crystal",0],["Chinook",0],
  ["Cascade",0],["Mosaic",0],["Centennial",0],["Citra",0],
  ["Idaho 7",0],["Lemondrop",0]
];
export const defYeast = [
  ["K97",0],["BE-134",0],["S-04",0],["US-05",0],
  ["WB-06",0],["BE-256",0],["KVEIK VOSS",0],["DA-16",0]
];
export const defAdj = [
  ["Candi Syrup",0,"lbs"],["Lactose",0,"lbs"],["Ghost Peppers",0,"each"],
  ["Straw/Rhubarb",0,"oz"],["Orange Peel",0,"oz"],["Coffee",0,"lbs"],
  ["Honey",0,"lbs"],["Lemon",0,"oz"],["Coriander",0,"oz"],["Mango Puree",0,"lbs"],
  ["Clarity Ferm",0,"ml"],["Brewzyme D",0,"ml"]
];

export const defRecipes = [
  {n:"All Y'alls",s:"NEIPA",m:[["2-Row",185],["White Wheat",55],["Flaked Wheat",35],["Flaked Oat",15]],h:[["Cascade",84],["Amarillo",40],["Chinook",8],["Mosaic",48],["Simcoe",16]],y:[["K97",1]],a:[]},
  {n:"Beachcomber",s:"Belgian Blond",m:[["Pils",110],["White Wheat",55],["Vienna",15],["Flaked Wheat",15],["Carafoam",10]],h:[["Amarillo",15],["Crystal",8]],y:[["BE-134",1]],a:[["Candi Syrup",5,"lbs"]]},
  {n:"Coffee Snout",s:"Baltic Porter",m:[["Maris Otter",165],["2-Row",110],["Munich",40],["Caramunich I",15],["Chocolate",12],["Roasted Barley",8],["Carafoam",5]],h:[["CTZ",12],["Willamette",12]],y:[["S-04",1]],a:[["Coffee",5,"lbs"]]},
  {n:"Hefelump",s:"Weissbier",m:[["Pils",110],["White Wheat",110],["Caramunich I",15],["Carafoam",10],["Vienna",10]],h:[["Saaz",20]],y:[["WB-06",1]],a:[["Orange Peel",3,"oz"]]},
  {n:"James",s:"American Brown",m:[["2-Row",110],["Maris Otter",110],["Caramunich I",35],["Chocolate",15],["Carafoam",10]],h:[["CTZ",10],["Willamette",4]],y:[["S-04",1]],a:[["Clarity Ferm",125,"ml"]]},
  {n:"Leder Jörtsen",s:"Festbier",m:[["Munich",110],["Pils",110],["Vienna",15],["Carafoam",10],["Caramunich I",10]],h:[["Amarillo",18],["Saaz",18]],y:[["K97",1]],a:[["Clarity Ferm",125,"ml"]]},
  {n:"Mango Unchained",s:"Double IPA",m:[["2-Row",330],["Flaked Wheat",20],["Carafoam",20],["Caramunich I",20]],h:[["CTZ",36],["Cascade",70],["Amarillo",60]],y:[["K97",1]],a:[["Lactose",15,"lbs"],["Mango Puree",18,"lbs"]]},
  {n:"Night Jörts",s:"Czech Dark Lager",m:[["Pils",185],["Carafe III",15],["Carafoam",8],["Caramunich I",8]],h:[["Centennial",22]],y:[["K97",1]],a:[["Clarity Ferm",125,"ml"]]},
  {n:"Pinkety Drinkety",s:"Cream Ale",m:[["Pils",165],["Flaked Corn",20],["Carafoam",5]],h:[["CTZ",5],["Saaz",5]],y:[["K97",10]],a:[["Straw/Rhubarb",62,"oz"],["Clarity Ferm",125,"ml"]]},
  {n:"Red Panda",s:"Belgian Tripel",m:[["Pils",300],["Caramunich I",20],["Aromatic",15],["Carafoam",12],["Roasted Barley",2]],h:[["CTZ",14],["Saaz",8]],y:[["BE-256",1]],a:[["Honey",18,"lbs"]]},
  {n:"Scarlett",s:"Red IPA",m:[["2-Row",110],["Maris Otter",110],["Munich",55],["Caramunich I",30],["Roasted Barley",4]],h:[["Chinook",18],["Centennial",60],["Cascade",54]],y:[["DA-16",1]],a:[]},
  {n:"Sheriff Bart IPA",s:"Black IPA",m:[["2-Row",275],["Caramunich I",22],["Midnight Wheat",22],["Chocolate",5]],h:[["CTZ",76],["Chinook",16],["Cascade",32]],y:[["US-05",1]],a:[]},
  {n:"Shortea Jörts",s:"Kölsch",m:[["Pils",165],["Vienna",15],["Carafoam",5]],h:[["Citra",14]],y:[["K97",1]],a:[["Lemon",32,"oz"],["Clarity Ferm",125,"ml"]]},
  {n:"Situation IPA",s:"American IPA",m:[["2-Row",235],["Caramunich I",30],["White Wheat",20],["Carafoam",15],["Aromatic",10],["Roasted Barley",1]],h:[["Chinook",27],["CTZ",20],["Cascade",8],["Amarillo",24],["Centennial",48]],y:[["K97",1]],a:[["Clarity Ferm",125,"ml"]]},
  {n:"Spruced Up",s:"American Pale Ale",m:[["2-Row",110],["Pils",110],["Caramunich I",25],["Carafoam",10],["Aromatic",8]],h:[["CTZ",12],["Cascade",104]],y:[["K97",1]],a:[["Clarity Ferm",125,"ml"]]},
  {n:"Stretchy Jörts",s:"Kölsch",m:[["Pils",165],["Vienna",20],["Carafoam",5]],h:[["Saaz",26]],y:[["K97",1]],a:[["Clarity Ferm",125,"ml"]]},
  {n:"Wicked Tickle",s:"American Porter",m:[["2-Row",110],["Maris Otter",110],["Caramunich I",55],["Black Patent",12],["Chocolate",10],["Carafoam",8],["Roasted Barley",8]],h:[["CTZ",14],["Willamette",16]],y:[["S-04",1]],a:[["Lactose",5,"lbs"],["Ghost Peppers",1,"each"]]},
  {n:"Wit's End",s:"Witbier",m:[["Pils",220],["White Wheat",55],["Flaked Wheat",22],["Carafoam",10]],h:[["CTZ",4],["Cascade",84],["Amarillo",76]],y:[["BE-256",1]],a:[["Coriander",1,"oz"],["Orange Peel",1,"oz"]]},
];

// Derived lookups used by recipe editing.
export const maltNames = defMalts.map(m=>m[0]);
export const hopNames = defHops.map(h=>h[0]);
export const yeastNames = defYeast.map(y=>y[0]);
export const adjNames = defAdj.map(a=>a[0]);
export const adjUnits = Object.fromEntries(defAdj.map(([n,,u])=>[n,u]));

// Tabs, in display order.
export const tabNames = ["Inventory", "Recipes", "Order Calculator", "Settings"];

// Default brewery identity, editable in the Settings tab.
export const defSettings = { name: "Slackers Brewing", tagline: "Inventory & Order Manager", emoji: "🍺", logo: null };

// Curated brewery-relevant emojis offered in the Settings icon picker.
export const breweryEmojis = ["🍺","🍻","🏭","🌾","🍷","🥂","🛢️","⚗️","🔥","🧪","🌿","🦫"];
