export async function register() {
  // Only run on server (not edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('\n🚀 Server starting - checking environment...\n');
    
    // Check OpenAI API Key
    const openaiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiKey) {
      console.error('❌ OPENAI_API_KEY is NOT set in environment variables!');
      console.error('   Voice chat will not work.');
      console.error('   Please add OPENAI_API_KEY to your .env file or hosting platform.\n');
    } else {
      console.log('✅ OPENAI_API_KEY is set');
      console.log(`   Key prefix: ${openaiKey.substring(0, 10)}...`);
      
      // Test the API key with a minimal request
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
          },
        });
        
        if (response.ok) {
          console.log('✅ OpenAI API key is VALID and working!\n');
        } else {
          const error = await response.json();
          console.error('❌ OpenAI API key validation FAILED!');
          console.error(`   Status: ${response.status}`);
          console.error(`   Error: ${error.error?.message || JSON.stringify(error)}\n`);
        }
      } catch (error) {
        console.error('❌ Failed to validate OpenAI API key:');
        console.error(`   ${error instanceof Error ? error.message : error}\n`);
      }
    }
    
    // Check other important environment variables
    const envChecks = [
      { name: 'NEXT_PUBLIC_SUPABASE_URL', value: process.env.NEXT_PUBLIC_SUPABASE_URL },
      { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      { name: 'CLERK_SECRET_KEY', value: process.env.CLERK_SECRET_KEY },
      { name: 'STRIPE_SECRET_KEY', value: process.env.STRIPE_SECRET_KEY },
    ];
    
    console.log('Environment variable status:');
    envChecks.forEach(({ name, value }) => {
      if (value) {
        console.log(`  ✅ ${name} is set`);
      } else {
        console.log(`  ⚠️  ${name} is NOT set`);
      }
    });
    console.log('\n');
  }
}
