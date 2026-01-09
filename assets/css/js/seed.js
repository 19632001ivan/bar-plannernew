(function seedOnce(){
  const seeded = Storage.get("bp_seeded", false);
  if (seeded) return;

  const cocktails = [
    {
      id: crypto.randomUUID(),
      name: "Mojito",
      method: "muddle",
      recipe: [
        { ingredient: "Ron", ml: 50 },
        { ingredient: "Jugo de limón", ml: 25 },
        { ingredient: "Jarabe simple", ml: 20 },
        { ingredient: "Soda", ml: 100 }
      ]
    },
    {
      id: crypto.randomUUID(),
      name: "Gin Tonic",
      method: "build",
      recipe: [
        { ingredient: "Gin", ml: 50 },
        { ingredient: "Tónica", ml: 150 }
      ]
    },
    {
      id: crypto.randomUUID(),
      name: "Margarita",
      method: "shake",
      recipe: [
        { ingredient: "Tequila", ml: 50 },
        { ingredient: "Triple sec", ml: 25 },
        { ingredient: "Jugo de limón", ml: 25 }
      ]
    }
  ];

  const events = [
    {
      id: crypto.randomUUID(),
      name: "Demo - Evento 100 tragos",
      date: new Date().toISOString().slice(0,10),
      mode: "by_drinks",
      totalDrinks: 100,
      wastePercent: 10,
      menu: [
        // percent debe sumar 100
        { cocktailId: cocktails[0].id, percent: 40 },
        { cocktailId: cocktails[1].id, percent: 35 },
        { cocktailId: cocktails[2].id, percent: 25 }
      ]
    }
  ];

  // Tamaños de botella por ingrediente (puedes ampliar luego)
  const bottleSizes = {
    "Ron": 750,
    "Gin": 750,
    "Tequila": 750,
    "Triple sec": 750,
    "Jugo de limón": 1000, // ejemplo (jugo en litro)
    "Jarabe simple": 1000,
    "Soda": 1500,
    "Tónica": 1500
  };

  Storage.set("bp_cocktails", cocktails);
  Storage.set("bp_events", events);
  Storage.set("bp_bottle_sizes", bottleSizes);
  Storage.set("bp_selected_event", events[0].id);
  Storage.set("bp_seeded", true);
})();
