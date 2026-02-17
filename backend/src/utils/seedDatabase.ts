/**
 * Database Seed Utility
 * 
 * Script to populate Supabase with sample events and songs for testing
 * Run with: npx ts-node backend/src/utils/seedDatabase.ts
 */

import { getSupabaseClient, isSupabaseConfigured } from '../config/supabase';

// Sample songs with lyrics
const SAMPLE_SONGS = [
  {
    title: 'Amazing Grace',
    artist: 'John Newton',
    lyrics: `Amazing grace how sweet the sound
That saved a wretch like me
I once was lost but now am found
Was blind but now I see

'Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed

Through many dangers toils and snares
I have already come
'Tis grace that brought me safe thus far
And grace will lead me home

When we've been there ten thousand years
Bright shining as the sun
We've no less days to sing God's praise
Than when we first begun`,
  },
  {
    title: 'How Great Thou Art',
    artist: 'Carl Boberg',
    lyrics: `O Lord my God when I in awesome wonder
Consider all the worlds thy hands have made
I see the stars I hear the rolling thunder
Thy power throughout the universe displayed

Then sings my soul my Savior God to thee
How great thou art how great thou art
Then sings my soul my Savior God to thee
How great thou art how great thou art

When through the woods and forest glades I wander
And hear the birds sing sweetly in the trees
If I but feel the wonder of creation
What mighty power flows out from Thee

When I in awesome wonder
Consider all the works thy hands have made
I see the stars I hear the mighty thunder
Thy power throughout the universe displayed`,
  },
  {
    title: 'Jesus Loves Me',
    artist: 'Anna Bartlett Warner',
    lyrics: `Jesus loves me this I know
For the Bible tells me so
Little ones to Him belong
They are weak but He is strong

Yes Jesus loves me
Yes Jesus loves me
Yes Jesus loves me
The Bible tells me so

Jesus loves me this I know
As He loved so long ago
Taking children on His knee
Saying let them come to me

Jesus loves me He will stay
Close beside me every day
If I love Him when I die
He will take me home on high`,
  },
];

async function seedDatabase() {
  console.log('🌱 Starting database seed...\n');

  // Check if Supabase is configured
  const supabase = getSupabaseClient();
  if (!isSupabaseConfigured() || !supabase) {
    console.error('❌ Supabase is not configured!');
    console.error('   Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
    process.exit(1);
  }

  try {
    // Get a test user - for this demo, we'll use the service role to create test data
    // In production, you'd use actual authenticated users
    
    // Use the actual user's email - change this to seed for your account
    const testEmail = process.env.SEED_USER_EMAIL || 'abybaiju7@gmail.com';
    const testPassword = 'Test123456!'; // Only used if creating new user
    
    // First, try to get existing user or create new one
    console.log('📝 Checking for test user...');
    let userId: string | undefined;
    
    // Try to list users and find existing one
    const { data: usersData } = await supabase.auth.admin.listUsers();
    const existingUser = usersData?.users.find(u => u.email === testEmail);
    
    if (existingUser) {
      userId = existingUser.id;
      console.log(`✅ Found existing user: ${userId}\n`);
    } else {
      // Create new user
      console.log('📝 Creating new test user...');
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
      });

      if (authError) {
        // If error is "email exists", try to get the user
        if (authError.message?.includes('already been registered') || authError.code === 'email_exists') {
          console.log('⚠️  User already exists, fetching user ID...');
          const { data: usersData2 } = await supabase.auth.admin.listUsers();
          const existingUser2 = usersData2?.users.find(u => u.email === testEmail);
          if (existingUser2) {
            userId = existingUser2.id;
            console.log(`✅ Using existing user: ${userId}\n`);
          } else {
            console.error('❌ User exists but could not be found');
            return;
          }
        } else {
          console.error('❌ Error creating user:', authError);
          return;
        }
      } else {
        userId = authData.user?.id;
        if (!userId) {
          console.error('❌ No user ID returned');
          return;
        }
        console.log(`✅ User created: ${userId}\n`);
      }
    }

    if (!userId) {
      console.error('❌ No user ID available');
      return;
    }

    // Create or update profile for the user
    console.log('📝 Creating/updating user profile...');
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert([
        {
          id: userId,
          username: 'test_user',
          subscription_tier: 'pro',
        },
      ], {
        onConflict: 'id'
      });

    if (profileError) {
      // If profile already exists, that's fine
      if (profileError.code === '23505') { // Unique violation
        console.log('✅ Profile already exists, continuing...\n');
      } else {
        console.error('❌ Error creating profile:', profileError);
        return;
      }
    } else {
      console.log('✅ Profile created/updated\n');
    }

    // Check for existing songs first
    console.log('📝 Checking for existing songs...');
    const { data: existingSongs } = await supabase
      .from('songs')
      .select('id, title')
      .eq('user_id', userId);

    const existingSongTitles = new Set(existingSongs?.map(s => s.title) || []);
    
    // Create sample songs (skip if already exist)
    console.log('📝 Creating sample songs...');
    const songIds: string[] = [];

    for (const songData of SAMPLE_SONGS) {
      // Skip if song already exists
      if (existingSongTitles.has(songData.title)) {
        console.log(`  ⏭️  ${songData.title} (already exists, skipping)`);
        // Get the existing song ID
        const existingSong = existingSongs?.find(s => s.title === songData.title);
        if (existingSong?.id) {
          songIds.push(existingSong.id);
        }
        continue;
      }

      const { data, error } = await supabase
        .from('songs')
        .insert([
          {
            user_id: userId,
            title: songData.title,
            artist: songData.artist,
            lyrics: songData.lyrics,
          },
        ])
        .select('id')
        .single();

      if (error) {
        console.error(`❌ Error creating song "${songData.title}":`, error);
        continue;
      }

      if (data?.id) {
        songIds.push(data.id);
        console.log(`  ✅ ${songData.title}`);
      }
    }

    console.log(`\n✅ Created ${songIds.length} songs\n`);

    // Check for existing event or create new one
    console.log('📝 Checking for existing test event...');
    const eventName = 'Sunday Service - December 14, 2025';
    
    const { data: existingEvents } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', userId)
      .eq('name', eventName)
      .limit(1);

    let eventId: string;
    
    if (existingEvents && existingEvents.length > 0) {
      eventId = existingEvents[0].id;
      console.log(`✅ Found existing event: ${eventId}\n`);
    } else {
      // Create a test event
      console.log('📝 Creating new test event...');
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert([
          {
            user_id: userId,
            name: eventName,
            event_date: new Date('2025-12-14T10:00:00').toISOString(),
            status: 'draft',
          },
        ])
        .select('id')
        .single();

      if (eventError || !eventData) {
        console.error('❌ Error creating event:', eventError);
        return;
      }

      eventId = eventData.id;
      console.log(`✅ Event created: ${eventId}\n`);
    }

    // Check existing setlist items
    const { data: existingItems } = await supabase
      .from('event_items')
      .select('song_id, sequence_order')
      .eq('event_id', eventId);

    const existingSequenceOrders = new Set(existingItems?.map(item => item.sequence_order) || []);
    
    // Add songs to the event setlist (skip if already added)
    console.log('📝 Adding songs to setlist...');
    let addedCount = 0;
    for (let i = 0; i < songIds.length; i++) {
      const sequenceOrder = i + 1;
      
      // Skip if this sequence order already exists
      if (existingSequenceOrders.has(sequenceOrder)) {
        console.log(`  ⏭️  Song ${sequenceOrder} (already in setlist, skipping)`);
        continue;
      }

      const { error } = await supabase
        .from('event_items')
        .insert([
          {
            event_id: eventId,
            song_id: songIds[i],
            sequence_order: sequenceOrder,
          },
        ]);

      if (error) {
        // If it's a unique constraint error, skip
        if (error.code === '23505') {
          console.log(`  ⏭️  Song ${sequenceOrder} (already exists, skipping)`);
          continue;
        }
        console.error(`❌ Error adding song to setlist:`, error);
        continue;
      }

      console.log(`  ✅ Song ${sequenceOrder} added to setlist`);
      addedCount++;
    }
    
    if (addedCount === 0 && songIds.length > 0) {
      console.log('  ℹ️  All songs already in setlist\n');
    }

    console.log('\n🎉 Database seed complete!\n');
    console.log('📊 Summary:');
    console.log(`  - User ID: ${userId}`);
    console.log(`  - Email: test@parleap.local`);
    console.log(`  - Event ID: ${eventId}`);
    console.log(`  - Songs: ${songIds.length}`);
    console.log(`\n💡 To test the WebSocket:
  1. Start the backend: npm run dev (in backend folder)
  2. Visit: http://localhost:3000/test-websocket
  3. Enter Event ID: ${eventId}
  4. Click "Start Session"\n`);
  } catch (error) {
    console.error('❌ Seed error:', error);
  }
}

// Run the seed
seedDatabase();

