export const generateMockData = () => {
  const numSellers = 5;
  const numProducts = 20;
  const numCategories = 3;

  const customerSegmentsData = [
    "Gen Z Shoppers",
    "Millennials",
    "Corporate Buyers",
    "Value Families"
  ];

  const categories = Array.from({ length: numCategories }, (_, i) => ({
    id: `cat-${i}`,
    type: "category",
    name: `Category ${i + 1}`,
  }));

  const sellers = Array.from({ length: numSellers }, (_, i) => ({
    id: `seller-${i}`,
    type: "seller",
    name: i === 0 ? "Me (My Store)" : `Competitor ${i}`,
    isMe: i === 0,
    rating: (Math.random() * 2 + 3).toFixed(1), // 3.0 - 5.0
  }));

  const customers = customerSegmentsData.map((name, i) => ({
    id: `customer-${i}`,
    type: "customer",
    name,
  }));

  const products = Array.from({ length: numProducts }, (_, i) => {
    const sellerId = `seller-${Math.floor(Math.random() * numSellers)}`;
    const categoryId = `cat-${Math.floor(Math.random() * numCategories)}`;
    const targetCustomerId = `customer-${Math.floor(Math.random() * customers.length)}`;
    
    // Cost and Price
    const cost = Math.floor(Math.random() * 80 + 10);
    const price = Math.floor(cost + Math.random() * 200 + 20); // Mark-up
    const rating = (Math.random() * 3 + 2).toFixed(1);

    // Base demand formula
    const baseDemand = Math.max(
      0,
      Math.floor(1000 - price * 1.5 + parseFloat(rating) * 50),
    );

    // Random elasticity between 0.5 (inelastic) and 2.5 (highly elastic)
    const demandElasticity = parseFloat((Math.random() * 2.0 + 0.5).toFixed(2));

    return {
      id: `product-${i}`,
      type: "product",
      name: `Product ${i + 1}`,
      sellerId,
      categoryId,
      targetCustomerId,
      cost,
      price,
      originalPrice: price,
      rating,
      demand: baseDemand,
      originalDemand: baseDemand,
      demandElasticity,
    };
  });

  const nodes = [...categories, ...sellers, ...products, ...customers];
  const links = [];

  // Edges
  products.forEach((p) => {
    // Seller -> Product edges
    links.push({
      source: p.sellerId,
      target: p.id,
      type: "owns",
    });
    // Product -> Category edges
    links.push({
      source: p.id,
      target: p.categoryId,
      type: "belongs_to",
    });
    // Product -> Customer edges
    links.push({
      source: p.id,
      target: p.targetCustomerId,
      type: "targets",
    });
  });

  // Calculate stats for sellers
  sellers.forEach((s: any) => {
    const sellerProducts = products.filter((p) => p.sellerId === s.id);
    s.productCount = sellerProducts.length;
    s.avgPrice = parseFloat(
      (sellerProducts.reduce((sum, p) => sum + p.price, 0) / (sellerProducts.length || 1)).toFixed(2)
    );
    s.profit = Math.floor(
      sellerProducts.reduce((sum, p) => sum + ((p.price - p.cost) * p.demand), 0)
    );
  });

  // Calculate stats for categories
  categories.forEach((c: any) => {
    const catProducts = products.filter((p) => p.categoryId === c.id);
    c.productCount = catProducts.length;
    c.avgPrice = parseFloat(
      (catProducts.reduce((sum, p) => sum + p.price, 0) / (catProducts.length || 1)).toFixed(2)
    );
    c.avgDemand = Math.floor(
      catProducts.reduce((sum, p) => sum + p.demand, 0) / (catProducts.length || 1)
    );
  });

  // Calculate stats for customers
  customers.forEach((cus: any) => {
    const cusProducts = products.filter((p) => p.targetCustomerId === cus.id);
    cus.productCount = cusProducts.length;
    cus.avgPricePref = parseFloat(
      (cusProducts.reduce((sum, p) => sum + p.price, 0) / (cusProducts.length || 1)).toFixed(2)
    );
  });

  // Product <-> Product edges (same category)
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      if (products[i].categoryId === products[j].categoryId) {
        links.push({
          source: products[i].id,
          target: products[j].id,
          type: "competes_with",
        });
      }
    }
  }

  return { nodes, links, products, sellers, categories, customers };
};
