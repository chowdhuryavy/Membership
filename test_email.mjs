import { emailService } from './services/emailService.js';
import { db } from './services/mockSupabase.js';

async function test() {
  console.log("Starting test...");
  try {
    const member = {
      id: 'test-123',
      guest_name: 'Test Member',
      membership_number: '123',
      outlet_id: 'f127209b-d327-4571-ad00-70682e623e96',
      email: 'test@example.com'
    };
    await emailService.sendMemberPurchaseEmail(member);
    console.log("Test finished.");
  } catch (err) {
    console.error("Test error:", err);
  }
}
test();
