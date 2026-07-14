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
  ["Clarity Ferm",0,"ml"],["Brewzyme D",0,"ml"],["Whirlfloc",0,"each"]
];
// Water-chemistry salts used per recipe (Mash Adds / Boil Adds on the brew
// sheet). Quantities live on recipes, not in inventory, so there is no qty here.
export const defSalts = [
  "Lactic Acid","CaCl2","CaSo4","Epsom","Chalk","Baking Soda","Salt"
];

// Addition stages. Brew-day stages print on the Brew Day sheet; cellar stages
// route to the (future) Cellar Summary sheet. Salts use mash/sparge/boil.
export const brewDayStages = ["mash","firstwort","boil","whirlpool","knockout"];
export const cellarStages = ["dryhop","primary","secondary","fining","rousing","transfer","keg","bottling"];
export const saltStages = ["mash","sparge","boil"];

// Cellar Summary schedule actions. A recipe's `sc` list is [[dayOffset, action], …];
// entering a brew date on the Cellar Summary sheet computes each action's date
// (brewDate + dayOffset) and routes it to the matching box (cold crash, bung,
// dry hop, rouse, transfer, carb, keg). Free text is allowed; this is the picker list.
export const cellarActions = [
  "Brew Date","Step Crash 55","Step Crash 40","Step Crash 33",
  "Bung | Pressure","Blow Off","Mini Blow Off","Dry Hop","Rouse",
  "Transfer","Carb","Keg",
];

export const defRecipes = [
  {n:"All Y'alls",s:"NEIPA",og:null,fg:null,abv:null,mt:155,m:[["2-Row",185],["White Wheat",55],["Flaked Wheat",35],["Flaked Oat",15]],h:[["Cascade",12,"boil",10],["Amarillo",16,"boil",7.5],["Cascade",12,"boil",5],["Amarillo",12,"whirlpool",20],["Cascade",12,"whirlpool",20],["Chinook",8,"whirlpool",20],["Cascade",48,"dryhop",0],["Mosaic",48,"dryhop",0],["Simcoe",16,"dryhop",0]],y:[["K97",1]],a:[],sa:[["CaCl2",100,"mash"],["CaSo4",40,"mash"],["CaCl2",80,"sparge"],["CaSo4",32,"sparge"]],sc:[[0,"Brew Date"],[11,"Step Crash 55"],[11,"Bung | Pressure"],[12,"Blow Off"],[12,"Dry Hop"],[13,"Mini Blow Off"],[13,"Rouse"],[13,"Step Crash 40"],[14,"Blow Off"],[14,"Step Crash 33"],[19,"Blow Off"],[19,"Transfer"],[20,"Blow Off"],[20,"Keg"]]},
  {n:"Beachcomber",s:"Belgian Blond",og:null,fg:null,abv:null,mt:152,m:[["Pils",110],["White Wheat",55],["Vienna",15],["Flaked Wheat",15],["Carafoam",10]],h:[["Amarillo",15,"boil",60],["Crystal",8,"boil",5]],y:[["BE-134",1]],a:[["Candi Syrup",5,"lbs","boil",15]],sa:[]},
  {n:"Coffee Snout",s:"Baltic Porter",og:null,fg:null,abv:null,mt:154,m:[["Maris Otter",165],["2-Row",110],["Munich",40],["Caramunich I",15],["Chocolate",12],["Roasted Barley",8],["Carafoam",5]],h:[["CTZ",12,"boil",60],["Willamette",12,"boil",5]],y:[["S-04",1]],a:[["Coffee",5,"lbs","secondary",0]],sa:[["CaSo4",60,"mash"],["Baking Soda",50,"mash"],["Salt",7,"mash"],["CaSo4",32,"sparge"],["Baking Soda",30,"sparge"],["Salt",4,"sparge"]]},
  {n:"Hefelump",s:"Weissbier",og:null,fg:null,abv:null,mt:152,m:[["Pils",110],["White Wheat",110],["Caramunich I",15],["Carafoam",10],["Vienna",10]],h:[["Saaz",14,"boil",60],["Saaz",6,"boil",5]],y:[["WB-06",1]],a:[["Orange Peel",3,"oz","boil",15]],sa:[["Chalk",11,"mash"],["Baking Soda",5,"mash"],["Chalk",95,"boil"],["Baking Soda",40,"boil"]]},
  {n:"James",s:"American Brown",og:null,fg:null,abv:null,mt:154,m:[["2-Row",110],["Maris Otter",110],["Caramunich I",35],["Chocolate",15],["Carafoam",10]],h:[["CTZ",10,"boil",60],["Willamette",4,"boil",15]],y:[["S-04",1]],a:[["Clarity Ferm",125,"ml","fermentation",0]],sa:[["Lactic Acid",50,"mash"],["CaSo4",48,"mash"],["Baking Soda",42,"mash"],["Chalk",10,"mash"],["Salt",6,"mash"],["CaSo4",42,"boil"],["Baking Soda",35,"boil"],["Chalk",6,"boil"],["Salt",5,"boil"]]},
  {n:"Leder Jörtsen",s:"Festbier",og:null,fg:null,abv:null,mt:152,m:[["Munich",110],["Pils",110],["Vienna",15],["Carafoam",10],["Caramunich I",10]],h:[["Amarillo",18,"boil",60],["Saaz",8,"boil",20],["Saaz",10,"boil",5]],y:[["K97",1]],a:[["Clarity Ferm",125,"ml","fermentation",0]],sa:[["Chalk",58,"mash"],["Baking Soda",24,"mash"],["Chalk",73,"boil"],["Baking Soda",30,"boil"]]},
  {n:"Mango Unchained",s:"Double IPA",og:null,fg:null,abv:null,mt:152,m:[["2-Row",330],["Flaked Wheat",20],["Carafoam",20],["Caramunich I",20]],h:[["CTZ",36,"boil",60],["Cascade",10,"boil",10],["Amarillo",12,"whirlpool",15],["Cascade",12,"whirlpool",15],["Amarillo",48,"dryhop",0],["Cascade",48,"dryhop",0]],y:[["K97",1]],a:[["Lactose",15,"lbs","boil",5],["Mango Puree",18,"lbs","secondary",0]],sa:[]},
  {n:"Night Jörts",s:"Czech Dark Lager",og:null,fg:null,abv:null,mt:152,m:[["Pils",185],["Carafe III",15],["Carafoam",8],["Caramunich I",8]],h:[["Centennial",16,"boil",60],["Centennial",6,"boil",5]],y:[["K97",1]],a:[["Clarity Ferm",125,"ml","fermentation",0]],sa:[["CaCl2",27,"mash"],["CaSo4",7,"mash"]]},
  {n:"Pinkety Drinkety",s:"Cream Ale",og:null,fg:null,abv:null,mt:148,m:[["Pils",165],["Flaked Corn",20],["Carafoam",5]],h:[["CTZ",5,"boil",60],["Saaz",5,"boil",5]],y:[["K97",10]],a:[["Straw/Rhubarb",62,"oz","secondary",0],["Clarity Ferm",125,"ml","fermentation",0]],sa:[]},
  {n:"Red Panda",s:"Belgian Tripel",og:null,fg:null,abv:null,mt:152,m:[["Pils",300],["Caramunich I",20],["Aromatic",15],["Carafoam",12],["Roasted Barley",2]],h:[["CTZ",14,"boil",60],["Saaz",8,"boil",5]],y:[["BE-256",1]],a:[["Honey",18,"lbs","boil",60],["Whirlfloc",12,"each","boil",15]],sa:[["CaSo4",51.87,"mash"],["Chalk",42,"mash"],["CaCl2",20,"mash"],["Salt",15,"mash"],["CaSo4",12,"boil"],["Chalk",10,"boil"],["CaCl2",5,"boil"],["Salt",4,"boil"]]},
  {n:"Scarlett",s:"Red IPA",og:null,fg:null,abv:null,mt:154,m:[["2-Row",110],["Maris Otter",110],["Munich",55],["Caramunich I",30],["Roasted Barley",4]],h:[["Chinook",18,"boil",60],["Centennial",18,"boil",15],["Cascade",18,"boil",10],["Centennial",42,"whirlpool",60],["Cascade",36,"dryhop",0]],y:[["DA-16",1]],a:[],sa:[["CaSo4",68,"mash"],["CaCl2",35,"mash"],["CaSo4",33,"boil"],["CaCl2",18,"boil"]]},
  {n:"Sheriff Bart IPA",s:"Black IPA",og:null,fg:null,abv:null,mt:152,m:[["2-Row",275],["Caramunich I",22],["Midnight Wheat",22],["Chocolate",5]],h:[["CTZ",12,"boil",60],["Chinook",16,"boil",20],["Cascade",32,"dryhop",0],["CTZ",8,"boil",20],["CTZ",24,"boil",5],["CTZ",32,"dryhop",0]],y:[["US-05",1]],a:[["Whirlfloc",12,"each","boil",15]],sa:[["CaSo4",48,"mash"],["CaCl2",45,"mash"],["Epsom",28,"mash"],["CaSo4",48,"boil"],["CaCl2",40,"boil"],["Epsom",28,"boil"]]},
  {n:"Shortea Jörts",s:"Kölsch",og:null,fg:null,abv:null,mt:152,m:[["Pils",165],["Vienna",15],["Carafoam",5]],h:[["Citra",8,"boil",60],["Citra",6,"boil",5]],y:[["K97",1]],a:[["Lemon",32,"oz","boil",0],["Clarity Ferm",125,"ml","fermentation",0]],sa:[["Lactic Acid",50,"mash"],["CaCl2",18,"mash"],["Epsom",11,"mash"],["CaSo4",9,"mash"],["CaCl2",30,"boil"],["Epsom",18,"boil"],["CaSo4",15,"boil"]]},
  {n:"Situation IPA",s:"American IPA",og:null,fg:null,abv:null,mt:152,m:[["2-Row",235],["Caramunich I",30],["White Wheat",20],["Carafoam",15],["Aromatic",10],["Roasted Barley",1]],h:[["Chinook",5,"boil",75],["CTZ",20,"boil",60],["Cascade",8,"boil",20],["Chinook",10,"boil",7.5],["Amarillo",12,"boil",5],["Amarillo",12,"whirlpool",15],["Chinook",12,"whirlpool",15],["Centennial",48,"dryhop",0],["Chinook",48,"dryhop",0]],y:[["K97",1]],a:[["Clarity Ferm",125,"ml","fermentation",0]],sa:[["CaSo4",58,"mash"],["CaCl2",52,"mash"],["Epsom",34,"mash"],["Lactic Acid",20,"mash"],["CaSo4",54,"boil"],["Chalk",50,"boil"],["CaCl2",48,"boil"],["Epsom",32,"boil"]]},
  {n:"Spruced Up",s:"American Pale Ale",og:null,fg:null,abv:null,mt:152,m:[["2-Row",110],["Pils",110],["Caramunich I",25],["Carafoam",10],["Aromatic",8]],h:[["CTZ",12,"boil",60],["Cascade",24,"boil",15],["Cascade",24,"boil",5],["Cascade",24,"whirlpool",5],["Cascade",32,"dryhop",0]],y:[["K97",1]],a:[["Clarity Ferm",125,"ml","fermentation",0]],sa:[]},
  {n:"Stretchy Jörts",s:"Kölsch",og:null,fg:null,abv:null,mt:152,m:[["Pils",165],["Vienna",20],["Carafoam",5]],h:[["Saaz",12,"boil",60],["Saaz",6,"boil",5],["Saaz",8,"whirlpool",20]],y:[["K97",1]],a:[["Clarity Ferm",125,"ml","fermentation",0]],sa:[["Chalk",137,"mash"],["Epsom",137,"mash"],["CaCl2",34,"mash"],["CaSo4",23,"mash"],["Lactic Acid",20,"mash"],["Chalk",232,"boil"],["Epsom",232,"boil"],["CaCl2",58,"boil"],["CaSo4",39,"boil"]]},
  {n:"Wicked Tickle",s:"American Porter",og:null,fg:null,abv:null,mt:152,m:[["2-Row",110],["Maris Otter",110],["Caramunich I",55],["Black Patent",12],["Chocolate",10],["Carafoam",8],["Roasted Barley",8]],h:[["CTZ",14,"firstwort",90],["Willamette",8,"boil",15],["Willamette",8,"boil",5]],y:[["S-04",1]],a:[["Lactose",5,"lbs","boil",5],["Whirlfloc",12,"each","boil",15],["Ghost Peppers",1,"each","secondary",0]],sa:[["CaCl2",120,"mash"],["CaSo4",30,"mash"],["Epsom",5,"mash"],["CaCl2",100,"boil"],["CaSo4",20,"boil"],["Epsom",5,"boil"]]},
  {n:"Wit's End",s:"Witbier",og:null,fg:null,abv:null,mt:152,m:[["Pils",220],["White Wheat",55],["Flaked Wheat",22],["Carafoam",10]],h:[["Cascade",12,"boil",10],["Amarillo",16,"boil",7.5],["Cascade",12,"boil",5],["Amarillo",12,"whirlpool",20],["Cascade",12,"whirlpool",20],["Amarillo",48,"dryhop",0],["Cascade",48,"dryhop",0],["CTZ",4,"boil",60]],y:[["BE-256",1]],a:[["Coriander",1,"oz","boil",0],["Orange Peel",1,"oz","boil",0]],sa:[]},
];

// Derived lookups used by recipe editing.
export const maltNames = defMalts.map(m=>m[0]);
export const hopNames = defHops.map(h=>h[0]);
export const yeastNames = defYeast.map(y=>y[0]);
export const adjNames = defAdj.map(a=>a[0]);
export const adjUnits = Object.fromEntries(defAdj.map(([n,,u])=>[n,u]));
export const saltNames = defSalts;

// Tabs, in display order.
export const tabNames = ["Inventory", "Recipes", "Order Calculator", "Settings"];

// Default brewery identity, editable in the Settings tab.
export const defSettings = { name: "Slackers Brewing", tagline: "Inventory & Order Manager", emoji: "🍺", logo: null };

// Curated brewery-relevant emojis offered in the Settings icon picker.
export const breweryEmojis = ["🍺","🍻","🏭","🌾","🍷","🥂","🛢️","⚗️","🔥","🧪","🌿","🦫"];
