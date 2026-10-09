// One brand identity for CRM saves, server rendering, counts and browser filters.
const brands = [
 ['Rolls-Royce', /rolls[\s-]*royce|cullinan|\bdawn\b/i],
 ['Mercedes-Benz', /mercedes|maybach|\bamg\b|g[\s-]?wagon/i],
 ['Land Rover', /land[\s-]*rover|range[\s-]*rover|defender/i],
 ['Chevrolet', /chevrolet|chevy|corvette|\bc8\b/i],
 ['Lamborghini', /lamborghini|\bhurac[aá]n\b|\burus\b|aventador/i],
 ['McLaren', /mc[\s-]*laren/i], ['Cadillac', /cadillac|escalade/i],
 ['Porsche', /porsche/i], ['Ferrari', /ferrari/i], ['Bentley', /bentley|continental/i],
 ['Tesla', /tesla/i], ['Lotus', /lotus|emira/i], ['Ford', /\bford\b|f-?150|raptor/i],
 ['Audi', /\baudi\b/i], ['BMW', /\bbmw\b/i],
];
export function brandFor(car = {}) {
 const make=String(car.make || '').trim().replace(/\s+/g,' ');
 // An explicit make wins over model names or unrelated words in a title.
 if(make) return brands.find(([,pattern])=>pattern.test(make))?.[0] || make;
 return brands.find(([,pattern])=>pattern.test(String(car.name || '')))?.[0] || 'Other';
}

export const featuredBrands = ['Porsche', 'Rolls-Royce', 'Lamborghini', 'Ferrari', 'McLaren', 'Mercedes-Benz'];
export function sortBrands(values) {
 return [...new Set(values)].sort((a,b)=>(featuredBrands.includes(a)?featuredBrands.indexOf(a):Infinity)-(featuredBrands.includes(b)?featuredBrands.indexOf(b):Infinity)||a.localeCompare(b));
}
