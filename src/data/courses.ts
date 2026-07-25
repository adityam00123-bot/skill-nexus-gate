import { categoryGroups } from "@/data/categoryData";

export interface Course {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  price: number;
  originalPrice: number;
  category: string;
  subcategory: string;
  instructor: string;
  rating: number;
  students: number;
  duration: string;
  lessons: number;
  level: "Beginner" | "Intermediate" | "Advanced";
  thumbnail: string;
  tags: string[];
  telegramLink: string;
  featured?: boolean;
}

const categoryIconMap: Record<string, string> = {
  trading: "📈",
  options: "📋",
  investing: "💰",
  "technical-analysis": "📊",
  "price-action-smc": "🎯",
  "indicators-tools": "🔧",
  "crypto-forex": "🪙",
  "algo-ai": "🤖",
};

export const categories = categoryGroups.map((cg) => ({
  id: cg.id,
  name: cg.name,
  icon: categoryIconMap[cg.id] || "📚",
  count: 0,
}));

const thumbnails = [
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&q=80",
  "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=600&q=80",
  "https://images.unsplash.com/photo-1560472355-536de3962603?w=600&q=80",
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&q=80",
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&q=80",
  "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=600&q=80",
  "https://images.unsplash.com/photo-1535320903710-d993d3d77d29?w=600&q=80",
];

const instructors = [
  "Alex Morgan", "Sarah Chen", "David Park", "Priya Sharma",
  "James Wilson", "Emily Rodriguez", "Michael Lee", "Jessica Brown",
];

const levels: Course["level"][] = ["Beginner", "Intermediate", "Advanced"];

// Course title templates per subcategory
const subTitles: Record<string, string[]> = {
  // Trading
  "intraday-trading": ["Intraday Trading Masterclass", "Day Trading Secrets", "Intraday Scalping Pro", "Morning Trade Setup"],
  "swing-trading": ["Swing Trading Blueprint", "Multi-Day Swing Mastery", "Swing Trade Setups", "Swing Patterns Pro"],
  "scalping": ["Scalping Techniques Pro", "1-Minute Scalping", "Ultra Scalping Mastery", "Fast Scalping System"],
  "positional-trading": ["Positional Trading Guide", "Long Positional Setups", "Positional Swing Combo", "Weekly Positional Strategy"],
  "trading-strategies": ["Trading Strategies A-Z", "Advanced Trading Systems", "Multi-Strategy Trading", "Risk-Reward Mastery"],
  // Options
  "option-buying": ["Option Buying Mastery", "Call & Put Buying Guide", "Weekly Option Buying", "Expiry Day Buying"],
  "option-selling": ["Option Selling Blueprint", "Iron Condor Mastery", "Theta Decay Profits", "Premium Selling Pro"],
  "options-strategies": ["Options Strategies Deep Dive", "Straddle & Strangle Pro", "Spread Strategies Mastery", "Multi-Leg Options"],
  "options-greeks": ["Options Greeks Decoded", "Delta Neutral Trading", "Volatility Trading Pro", "Gamma Scalping Mastery"],
  "futures-trading": ["Futures Trading Fundamentals", "Index Futures Pro", "Commodity Futures Guide", "Futures Hedging Mastery"],
  // Investing
  "long-term-investing": ["Long-Term Wealth Builder", "Buy & Hold Mastery", "Compounding Wealth Guide", "Retirement Investing"],
  "value-investing": ["Value Investing Fundamentals", "Buffett-Style Investing", "Undervalued Stock Picker", "Deep Value Analysis"],
  "growth-investing": ["Growth Stock Mastery", "Tech Growth Investing", "High-Growth Portfolio", "Momentum Growth Strategy"],
  "dividend-investing": ["Dividend Income Mastery", "Monthly Dividend Builder", "Dividend Aristocrats Guide", "Passive Income Dividends"],
  "portfolio-management": ["Portfolio Management Pro", "Asset Allocation Guide", "Rebalancing Strategies", "Risk-Adjusted Returns"],
  // Technical Analysis
  "chart-patterns": ["Chart Patterns Mastery", "Head & Shoulders Pro", "Triangle Patterns Guide", "Breakout Pattern Trading"],
  "candlestick-analysis": ["Candlestick Analysis Pro", "Japanese Candle Mastery", "Reversal Patterns Guide", "Candle Psychology"],
  "support-resistance": ["Support & Resistance Pro", "Key Levels Mastery", "Demand & Supply Zones", "Pivot Point Trading"],
  "trend-analysis": ["Trend Analysis Mastery", "Trend Following Systems", "Multi-Timeframe Trends", "Trend Reversal Signals"],
  // Price Action / SMC
  "price-action-basics": ["Price Action Mastery", "Naked Chart Trading", "Price Action Setups", "Clean Chart Analysis"],
  "smart-money-concepts": ["Smart Money Concepts Masterclass", "Institutional Trading Decoded", "SMC Order Flow", "Smart Money Footprint"],
  "ict-concepts": ["ICT Concepts Full Course", "ICT Mentorship Decoded", "ICT Market Structure", "ICT Entry Models"],
  "order-blocks": ["Order Blocks Mastery", "Institutional Order Blocks", "OB Trading Strategy", "Mitigation Block Trading"],
  "fair-value-gaps": ["Fair Value Gap Trading", "FVG Mastery Course", "Imbalance Trading Pro", "Gap Fill Strategies"],
  // Indicators & Tools
  "moving-averages": ["Moving Average Mastery", "EMA Crossover Systems", "SMA Trading Strategies", "Dynamic MA Trading"],
  "rsi": ["RSI Trading Mastery", "RSI Divergence Pro", "Overbought/Oversold Trading", "RSI Swing Strategy"],
  "macd": ["MACD Trading Blueprint", "MACD Histogram Trading", "MACD Divergence Mastery", "Signal Line Strategies"],
  "bollinger-bands": ["Bollinger Bands Mastery", "Bollinger Squeeze Trading", "Band Width Strategies", "Volatility Band Trading"],
  "tradingview-tools": ["TradingView Mastery", "Pine Script Basics", "Custom Indicators Build", "TradingView Alerts Pro"],
  // Crypto & Forex
  "crypto-trading": ["Crypto Trading Essentials", "Bitcoin Trading Pro", "Altcoin Trading Mastery", "Crypto Swing Trading"],
  "spot-trading": ["Spot Trading Fundamentals", "Spot Market Mastery", "Exchange Spot Trading", "Spot vs Margin Guide"],
  "defi": ["DeFi Fundamentals", "Yield Farming Mastery", "Liquidity Pool Guide", "DeFi Protocol Analysis"],
  "web3": ["Web3 Essentials", "Blockchain Development Intro", "NFT Trading Guide", "Web3 Investing"],
  "forex-basics": ["Forex Basics Masterclass", "Currency Pair Trading", "Forex Market Structure", "Pip & Lot Sizing"],
  "forex-strategies": ["Forex Strategies Pro", "London Session Trading", "News Trading Forex", "Carry Trade Strategy"],
  // Algo & AI
  "algo-trading-basics": ["Algo Trading Fundamentals", "Automated Trading Setup", "Algo Strategy Design", "Systematic Trading"],
  "backtesting": ["Backtesting Mastery", "Strategy Backtesting Pro", "Walk-Forward Analysis", "Monte Carlo Testing"],
  "python-for-trading": ["Python for Trading", "Pandas for Finance", "Python Algo Bot", "Data Analysis Trading"],
  "quantitative-strategies": ["Quantitative Strategies Pro", "Statistical Arbitrage", "Quant Model Building", "Factor Investing"],
  "trading-bots": ["Trading Bot Builder", "Crypto Bot Mastery", "Auto-Trading Systems", "Bot Strategy Design"],
  "ai-tools-automation": ["AI Tools for Trading", "ChatGPT for Traders", "ML Price Prediction", "AI Automation Pro"],
  "video-editing": ["Video Editing Mastery", "Content Creation Pro", "Financial Video Production", "YouTube for Traders"],
  "graphic-design": ["Graphic Design for Finance", "Canva for Traders", "Social Media Graphics", "Brand Design Pro"],
  "digital-productivity": ["Digital Productivity Tools", "Notion for Traders", "Automation Workflows", "Productivity Mastery"],
};

function generateCourse(id: number, categoryId: string, subcategoryId: string, titleIdx: number): Course {
  const titles = subTitles[subcategoryId] || [`${subcategoryId} Course`];
  const title = titles[titleIdx % titles.length];
  const volSuffix = titleIdx >= titles.length ? ` Vol. ${Math.floor(titleIdx / titles.length) + 1}` : "";
  const price = Math.floor(Math.random() * 180) + 19;

  return {
    id: `course-${id}`,
    title: `${title}${volSuffix}`,
    description: `Master the essentials of ${title.toLowerCase()} with hands-on projects and real-world examples. Perfect for anyone looking to advance their skills.`,
    longDescription: `This comprehensive course covers everything you need to know about ${title.toLowerCase()}. You'll learn from industry experts through video lectures, practical exercises, and real-world case studies.\n\nWhat you'll learn:\n• Core concepts and fundamentals\n• Advanced strategies and techniques\n• Risk management and best practices\n• Real-world application and case studies\n• Hands-on projects and assignments\n\nThis course is designed for both beginners and experienced professionals looking to deepen their knowledge.`,
    price,
    originalPrice: Math.floor(price * (1.5 + Math.random())),
    category: categoryId,
    subcategory: subcategoryId,
    instructor: instructors[id % instructors.length],
    rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
    students: Math.floor(Math.random() * 50000) + 500,
    duration: `${Math.floor(Math.random() * 40) + 5}h ${Math.floor(Math.random() * 59)}m`,
    lessons: Math.floor(Math.random() * 150) + 20,
    level: levels[id % 3],
    thumbnail: thumbnails[id % thumbnails.length],
    tags: [categoryId, subcategoryId, levels[id % 3].toLowerCase()],
    telegramLink: "https://t.me/+example",
    featured: id < 8,
  };
}

// Generate ~2100 courses spread across all categories & subcategories
export const courses: Course[] = [];
let courseId = 0;

// ──────────────────────────────────────────────────────────────
// DUMMY COURSES DISABLED — Only real Supabase courses will show.
// Un-comment the block below to re-enable ~2100 generated courses.
// ──────────────────────────────────────────────────────────────

// const COURSES_PER_SUB = 5;
// for (let round = 0; round < COURSES_PER_SUB; round++) {
//   for (const cat of categoryGroups) {
//     for (const sub of cat.subcategories) {
//       courses.push(generateCourse(courseId++, cat.id, sub.id, round));
//     }
//   }
// }
//
// while (courses.length < 2100) {
//   const cat = categoryGroups[courseId % categoryGroups.length];
//   const sub = cat.subcategories[courseId % cat.subcategories.length];
//   const round = COURSES_PER_SUB + Math.floor((courseId - COURSES_PER_SUB * categoryGroups.length) / categoryGroups.length);
//   courses.push(generateCourse(courseId++, cat.id, sub.id, round));
// }

// Update category counts
categories.forEach((c) => {
  c.count = courses.filter((course) => course.category === c.id).length;
});

export function searchCourses(query: string, category?: string, subcategory?: string): Course[] {
  const q = query.toLowerCase();
  return courses.filter((c) => {
    const matchesQuery = !q || c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.instructor.toLowerCase().includes(q);
    const matchesCat = !category || category === "all" || c.category === category;
    const matchesSub = !subcategory || c.subcategory === subcategory;
    return matchesQuery && matchesCat && matchesSub;
  });
}

export function getCourseById(id: string): Course | undefined {
  return courses.find((c) => c.id === id);
}

export function getFeaturedCourses(): Course[] {
  return courses.filter((c) => c.featured);
}

export function getCoursesByCategory(categoryId: string): Course[] {
  return courses.filter((c) => c.category === categoryId);
}
