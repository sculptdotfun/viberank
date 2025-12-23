
import { getLeaderboard } from '../src/lib/db/operations';

async function main() {
  console.log('--- Verifying Dashboard Fixes ---');

  // Test 1: Get All Time (Deduplication Check)
  console.log('\n1. Testing "All Time" (Deduplication)...');
  const allTime = await getLeaderboard({ limit: 10 });
  
  const uniqueUsers = new Set(allTime.map(s => s.username || s.email));
  if (allTime.length === uniqueUsers.size) {
    console.log('✅ PASS: No duplicate users found in top 10.');
  } else {
    console.log(`❌ FAIL: Found ${allTime.length} items but only ${uniqueUsers.size} unique users.`);
    allTime.forEach(s => console.log(` - ${s.username || s.email} ($${s.totalCost})`));
  }
  
  // Test 2: Date Filtering (7 Days)
  console.log('\n2. Testing "7 Days" Filter...');
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  
  const dateFrom = sevenDaysAgo.toISOString().split('T')[0];
  const dateTo = today.toISOString().split('T')[0];
  
  const sevenDays = await getLeaderboard({ 
    dateFrom, 
    dateTo,
    limit: 5 
  });
  
  if (sevenDays.length > 0) {
    const sample = sevenDays[0];
    console.log(` Checking sample user: ${sample.username || sample.email}`);
    console.log(` Calculated Total Cost (7d): ${sample.totalCost}`);
    
    // Verify calculation manually if we can access dailyBreakdown (it should be returned)
    if (sample.dailyBreakdown) {
       const manualSum = sample.dailyBreakdown
        .filter((d: any) => d.date >= dateFrom && d.date <= dateTo)
        .reduce((acc: number, d: any) => acc + d.totalCost, 0);
        
       if (Math.abs(manualSum - Number(sample.totalCost)) < 0.01) {
         console.log('✅ PASS: Total cost matches sum of daily entries.');
       } else {
         console.log(`❌ FAIL: Calculated ${sample.totalCost} but manual sum is ${manualSum}`);
       }
    }
  } else {
    console.log('⚠️ Warning: No submissions found for 7 days test.');
  }

  console.log('\n--- Verification Complete ---');
  process.exit(0);
}

main().catch(console.error);
