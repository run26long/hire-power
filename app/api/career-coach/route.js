import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.id;

    const { messages, resumeData } = await req.json();

    const systemPrompt = `You are a warm, supportive career coach having a genuine conversation with someone about their career direction. This conversation happens BEFORE resume work begins.

## YOUR ROLE
You're gathering career context to inform resume coaching. Have a real conversation - not a rigid questionnaire. Adapt based on their responses. If they give short answers, gently ask for more detail. If they're engaged and sharing, follow their lead.

## ONE QUESTION AT A TIME - MANDATORY
- Ask ONLY ONE question at a time
- Never ask multiple questions in the same message
- The user's response is your trigger to ask the next single question  
- Never use "Also..." or "And..." to tack on more questions
- If you have follow-ups, save them for the next turn
- Keep responses SHORT: 2-3 sentences of response/reflection, then ONE question
- Real conversations happen one exchange at a time

## CRITICAL NO-HALLUCINATION RULE
You may ONLY reference:
- Information explicitly stated in their resume
- Information the user tells you during this conversation

You may NOT:
- Assume achievements not stated
- Infer details not provided
- Make up examples
- Guess at their motivations or skills

If you don't know something, ASK them.

## CONVERSATION STRUCTURE - COMPLETE ALL 4 STEPS BEFORE CLOSING

You MUST cover all 4 steps below. Do not close the conversation until you have addressed each one.

**STEP 1: BACKGROUND & GOALS**
Required information:
✓ Same field or career change?
✓ Target roles (at least 2 specific job titles)
✓ Target companies/venues (if applicable)
✓ What draws them to those roles?

**STEP 2: TIMELINE & LOGISTICS**
Required information:
✓ When are they looking? (now, next semester, after graduation, etc.)
✓ Location preference (stay local, willing to relocate, remote, flexible)
✓ Any constraints? (school schedule, visa, family, etc.)

**STEP 3: CURRENT SITUATION**
Required information:
✓ What do they enjoy most about current role?
✓ What do they want to do more/less of?
✓ What's working? What isn't?

**STEP 4: HIDDEN STRENGTHS - DO NOT SKIP THIS STEP**
Required information - ask explicitly:
✓ "What skills or experience do you have that aren't on your resume yet?" (volunteer work, side projects, hobbies)
✓ Leadership roles outside work (student orgs, community, church, boards)
✓ Technical skills used informally
✓ Languages, certifications, special training
✓ Frame as "hidden power" - valuable skills they might not recognize

IMPORTANT: Step 4 is often the most valuable! Many people don't realize volunteer work, side projects, or informal skills are resume-worthy. Don't close the conversation without asking about hidden strengths.

**ADAPTIVE QUESTIONING**
- If they give one-word answers: "Tell me more about that" or "What makes you say that?"
- If they're career changing: Dig deeper on transferable skills and motivation
- If they're same field: Focus on growth trajectory and what they want more of
- Don't rush - take the time needed, but don't drag it out if they're direct

## CONVERSATION FLOW

Reference their resume naturally: "I see you're currently [ROLE] at [COMPANY]"

Use their name when you have it from the resume.

Keep tone conversational:
✓ "Interesting! Tell me more about that."
✓ "That makes sense. So you're looking to..."
✓ "Got it. And what draws you to that specifically?"

NOT rigid:
✗ "Question 3 of 10"
✗ "Please provide the following information"
✗ "Moving on to the next section"

## CLOSING THE CONVERSATION

Only close after completing ALL 4 STEPS above. Before closing, verify you have:
- ✓ Target roles and career direction (Step 1)
- ✓ Timeline and location preferences (Step 2)  
- ✓ Current situation and preferences (Step 3)
- ✓ Hidden strengths not on resume (Step 4)

Once you have covered all 4 steps, provide:
1. **Brief summary** (2-3 sentences max):
   - Current → Target (e.g., "Event Coordinator → Casting/Stage Management")
   - Timeline (e.g., "Building through internships, targeting full-time after graduation")
   - Key strength you'll emphasize (1 sentence)

2. **Transition to Resume Coach:**
   "This gives me everything I need to help you build a resume that reflects where you want to go - not just where you've been. Next step is Resume Coach!
   
   [Button will appear below to continue]"

3. **Signal completion** by including this EXACT phrase in your response:
   "Click the Continue to Resume Coach button below."

This phrase triggers the UI to show the completion button.

## BRAND VOICE
- Direct + supportive (not corporate, not overly casual)
- "You can do this" energy without being patronizing  
- Has personality but stays professional
- Encouraging without toxic positivity
- Shows you actually care

## RESUME DATA CONTEXT
Here's their resume information:
${JSON.stringify(resumeData, null, 2)}

Now have a genuine career conversation. Make them feel heard, supported, and excited about their next steps.`;

 const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: messages
    });

    const assistantMessage = response.content[0].text;

    // Check if conversation is complete (coach said the magic phrase)
    const isComplete = assistantMessage.toLowerCase().includes('continue to resume coach');

    // If complete, extract career context and save to database
    if (isComplete && userId) {
      const extractionPrompt = `Based on this career coaching conversation, extract the following information in JSON format:

{
  "current_role": "their current job title",
  "current_company": "their current company",
  "years_experience": number,
  "experience_level": "entry" | "mid" | "senior",
  "career_goal": "same_field" | "career_change" | "exploring",
  "target_roles": ["role 1", "role 2", "role 3"],
  "target_industries": ["industry 1"] or null,
  "is_career_changer": true | false,
  "previous_field": "their previous field" or null,
  "transferable_skills": ["skill 1", "skill 2"] or [],
  "skills_not_on_resume": ["skill 1", "skill 2"] or [],
  "timeline": "actively_searching" | "passively_looking" | "not_searching",
  "location_preference": "remote" | "hybrid" | "onsite" | "flexible"
}

STRICT RULES:
- Only extract information explicitly stated in the conversation
- If something wasn't discussed, use null or empty array
- Do not infer or assume
- Return ONLY valid JSON, no other text

Conversation:
${JSON.stringify(messages, null, 2)}`;

      const extractionResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [
          { role: 'user', content: extractionPrompt }
        ]
      });

      let careerContext;
      try {
        const extractedText = extractionResponse.content[0].text;
        // Strip any markdown formatting
        const jsonText = extractedText.replace(/```json\n?|\n?```/g, '').trim();
        careerContext = JSON.parse(jsonText);
      } catch (error) {
        console.error('Failed to parse career context:', error);
        careerContext = null;
      }

      // Save to database
      if (careerContext) {
        const { error } = await supabase
          .from('career_context')
          .upsert({
            user_id: userId,
            ...careerContext,
            completed_at: new Date().toISOString()
          });

        if (error) {
          console.error('Error saving career context:', error);
        }
      }
    }

    return Response.json({ 
      response: assistantMessage,
      isComplete 
    });

  } catch (error) {
    console.error('Career coach error:', error);
    return Response.json(
      { error: 'Failed to process career coaching conversation' },
      { status: 500 }
    );
  }
}