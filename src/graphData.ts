import staticRawData from './crawledData.json';

export interface CrawledRow {
  shop: string;
  name: string;
  rating: number;
  price: number;
  sold: number;
  region: string;
  discount: number;
}

export interface ProductNode {
  id: string;
  type: 'product';
  name: string;
  shopId: string;
  regionId: string;
  price: number;
  originalPrice: number;
  sold: number;
  originalSold: number;
  rating: number;
  discount: number;
  originalDiscount: number;
  revenue: number;
}

export interface ShopNode {
  id: string;
  type: 'shop';
  name: string;
  isMe: boolean;
  rating: number;
  productCount: number;
  totalRevenue: number;
  avgPrice: number;
}

export interface RegionNode {
  id: string;
  type: 'region';
  name: string;
  shopCount: number;
  productCount: number;
  totalRevenue: number;
}

export interface GraphLink {
  source: string;
  target: string;
  type: 'sells' | 'located_in' | 'competes_with';
}

export interface GraphMetrics {
  maxProductRevenue: number;
  maxShopRevenue: number;
  maxRegionRevenue: number;
  maxPrice: number;
  maxSold: number;
}

export function generateGraphData(data?: CrawledRow[]) {
  const rawData = (data && data.length > 0) ? data : staticRawData;
  const products: ProductNode[] = [];
  const shops: ShopNode[] = [];
  const regions: RegionNode[] = [];
  const links: GraphLink[] = [];

  const shopMap = new Map<string, any>();
  const regionMap = new Map<string, any>();
  const shopRegionLinks = new Set<string>();

  // --- Pass 1: Create products and collect shop/region info ---
  rawData.forEach((row: any, i: number) => {
    const shopName = (row.shop || '').trim();
    const regionName = (row.region || '').trim();
    if (!shopName || !regionName) return;

    const shopId = `shop-${shopName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const regionId = `region-${regionName.toLowerCase().replace(/[^a-zà-ỹ0-9]/g, '_')}`;
    const productId = `product-${i}`;

    const price = Number(row.price) || 0;
    const sold = Number(row.sold) || 0;
    const rating = Number(row.rating) || 0;
    const discount = Number(row.discount) || 0;
    const actualPrice = price * (1 - discount);
    const revenue = actualPrice * sold;

    // Truncate product name for display (keep first 50 chars)
    const displayName = row.name.length > 50 ? row.name.substring(0, 47) + '...' : row.name;

    products.push({
      id: productId,
      type: 'product',
      name: displayName,
      shopId,
      regionId,
      price,
      originalPrice: price,
      sold,
      originalSold: sold,
      rating,
      discount,
      originalDiscount: discount,
      revenue,
    });

    // Track shop
    if (!shopMap.has(shopId)) {
      shopMap.set(shopId, {
        id: shopId,
        type: 'shop',
        name: shopName,
        isMe: i === 0, // first shop = "Me"
        ratings: [],
        productCount: 0,
        totalRevenue: 0,
        totalPrice: 0,
      });
    }
    const shop = shopMap.get(shopId);
    shop.ratings.push(rating);
    shop.productCount++;
    shop.totalRevenue += revenue;
    shop.totalPrice += price;

    // Track region
    if (!regionMap.has(regionId)) {
      regionMap.set(regionId, {
        id: regionId,
        type: 'region',
        name: regionName,
        shopIds: new Set<string>(),
        productCount: 0,
        totalRevenue: 0,
      });
    }
    const region = regionMap.get(regionId);
    region.shopIds.add(shopId);
    region.productCount++;
    region.totalRevenue += revenue;

    // Links: shop → product
    links.push({ source: shopId, target: productId, type: 'sells' });

    // Links: shop → region (deduplicated)
    const linkKey = `${shopId}-${regionId}`;
    if (!shopRegionLinks.has(linkKey)) {
      shopRegionLinks.add(linkKey);
      links.push({ source: shopId, target: regionId, type: 'located_in' });
    }
  });

  // --- Pass 2: Finalize shops ---
  shopMap.forEach((s) => {
    shops.push({
      id: s.id,
      type: 'shop',
      name: s.name,
      isMe: s.isMe,
      rating: parseFloat((s.ratings.reduce((a: number, b: number) => a + b, 0) / s.ratings.length).toFixed(2)),
      productCount: s.productCount,
      totalRevenue: Math.floor(s.totalRevenue),
      avgPrice: Math.floor(s.totalPrice / s.productCount),
    });
  });

  // --- Pass 3: Finalize regions ---
  regionMap.forEach((r) => {
    regions.push({
      id: r.id,
      type: 'region',
      name: r.name,
      shopCount: r.shopIds.size,
      productCount: r.productCount,
      totalRevenue: Math.floor(r.totalRevenue),
    });
  });

  // --- Pass 4: Competition links ---
  // Products from DIFFERENT shops compete if their prices are within 50% of each other
  // We limit this to avoid too many links (sample top products per shop)
  const topProductsPerShop = new Map<string, ProductNode[]>();
  products.forEach((p) => {
    if (!topProductsPerShop.has(p.shopId)) topProductsPerShop.set(p.shopId, []);
    topProductsPerShop.get(p.shopId)!.push(p);
  });
  // Keep top 10 by revenue per shop for competition links
  topProductsPerShop.forEach((prods, shopId) => {
    prods.sort((a, b) => b.revenue - a.revenue);
    topProductsPerShop.set(shopId, prods.slice(0, 10));
  });

  const shopIds = [...topProductsPerShop.keys()];
  for (let i = 0; i < shopIds.length; i++) {
    for (let j = i + 1; j < shopIds.length; j++) {
      const prodsA = topProductsPerShop.get(shopIds[i])!;
      const prodsB = topProductsPerShop.get(shopIds[j])!;
      for (const a of prodsA) {
        for (const b of prodsB) {
          const priceDiff = Math.abs(a.price - b.price);
          const avgPrice = (a.price + b.price) / 2;
          if (avgPrice > 0 && priceDiff / avgPrice < 0.5) {
            links.push({ source: a.id, target: b.id, type: 'competes_with' });
          }
        }
      }
    }
  }

  // --- Compute metrics ---
  const metrics: GraphMetrics = {
    maxProductRevenue: Math.max(...products.map((p) => p.revenue), 1),
    maxShopRevenue: Math.max(...shops.map((s) => s.totalRevenue), 1),
    maxRegionRevenue: Math.max(...regions.map((r) => r.totalRevenue), 1),
    maxPrice: Math.max(...products.map((p) => p.price), 1),
    maxSold: Math.max(...products.map((p) => p.sold), 1),
  };

  const nodes = [...regions, ...shops, ...products];

  return { nodes, links, products, shops, regions, metrics };
}
