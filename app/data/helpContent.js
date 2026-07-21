const helpContent = [
  {
    title: 'Getting Started',
    questions: [
      {
        question: 'What is Hire Power and how does it work?',
        answer: 'Hire Power is an AI career platform that helps you build and improve a core resume, compare it with job descriptions, create tailored resumes and cover letters, practice for interviews, and track applications. Start with your core resume, then use the other tools as you move through your job search.'
      },
      {
        question: "What's the difference between Free and Pro?",
        answer: 'Free includes core resume analysis, templates, unlimited downloads, job tracking, 3 Job Match Scores, and 3 custom cover letters. Pro costs $29.99 per month and adds full Resume Coach access and automatic improvements, unlimited job-specific resumes, Job Match Scores and cover letters, Career Vault, and Pro Interview Coach features as they become available.'
      },
      {
        question: 'How do I upgrade to Pro?',
        answer: 'Choose Go Pro in Hire Power, then complete the secure Stripe checkout. Pro costs $29.99 per month and renews monthly until you cancel.'
      },
      {
        question: 'How do I cancel or change my subscription?',
        answer: 'Open Profile and go to the Plan section. You can switch from Pro to the $4.99-per-month Vault plan or select Cancel Subscription; if you cancel, you keep Pro access until the end of the current billing period.'
      }
    ]
  },
  {
    title: 'Resume Coach',
    questions: [
      {
        question: 'How does the coaching conversation work?',
        answer: "Resume Coach asks focused questions about your work and goals, one at a time, to uncover achievements, results, and skills that may be missing from the page. Give the full story in paragraphs rather than trying to write polished bullets; Hire Power uses the details to strengthen your resume, and you should review every change for accuracy."
      },
      {
        question: 'How long does the coaching conversation take?',
        answer: 'Plan for about 20 minutes. It can be faster or slower depending on how much experience you have and how detailed your answers are.'
      },
      {
        question: 'Can I redo the coaching conversation?',
        answer: "You can return to Resume Coach to continue an unfinished conversation, and your progress is saved automatically. Once a coaching conversation is finished, you can't redo it, but you can open Format and select More to add to include new details."
      },
      {
        question: 'Can I go back and view my coaching conversation after it\'s finished?',
        answer: 'Yes. Open the Coach section to view the conversation again after you finish it.'
      },
      {
        question: 'Do I need to hit save after editing my resume manually?',
        answer: 'Yes. You need to save manual edits yourself; the reminder notification appears once, and the Save button blinks while you have unsaved changes.'
      },
      {
        question: 'What does the lightning bolt icon do on resume bullets?',
        answer: 'The lightning bolt opens an AI tool with Reword and Fix options. Reword generates alternative versions of the bullet, while Fix asks what\'s wrong so the AI can correct it.'
      },
      {
        question: 'How do I add new information after coaching is complete?',
        answer: 'Open Format and select More to add to include more information after coaching is complete. You can also edit the resume directly or use the Add controls to create a new bullet, job, education entry, project, language, or section.'
      }
    ]
  },
  {
    title: 'Resume Scores',
    questions: [
      {
        question: 'What does my resume score mean?',
        answer: 'The Resume Power Score measures how effectively the document communicates your experience; it does not grade your worth or potential as a candidate. It combines Impact, Clarity, and Keywords into a score out of 100.'
      },
      {
        question: 'What do Impact, Clarity, and Keywords measure?',
        answer: 'Impact looks at specificity, scope, and scale and is worth 50 points. Clarity looks at active voice, strong verbs, and concise language for 30 points, while Keywords checks field vocabulary, tools, and software names for 20 points.'
      },
      {
        question: 'How do I improve my score in a specific category?',
        answer: "Start with the lowest category and use the assessment's What Is Missing and Action Plan guidance to revise the resume. When you are done, select Re-assess to calculate the score again."
      },
      {
        question: 'Is the score based on my career or how well my resume communicates?',
        answer: 'It is based mainly on how well the resume communicates the career you already have. Clear wording, relevant details, measurable results, and the right vocabulary can raise the score without changing the facts of your experience.'
      }
    ]
  },
  {
    title: 'Job-Specific Resume',
    questions: [
      {
        question: 'What is a job-specific resume?',
        answer: 'A job-specific resume is a separate version of your core resume tailored to one role. Add the job title, company, and job description, and Hire Power analyzes the match and helps you emphasize the most relevant parts of your real experience; this feature is Pro only.'
      },
      {
        question: 'How is the job-specific score different from my main resume score?',
        answer: 'Your main Resume Power Score measures the resume\'s overall communication across Impact, Clarity, and Keywords. The percentage shown for a job-specific resume is a Job Match Score that compares your experience with that particular job description.'
      },
      {
        question: 'Can I see a breakdown of the job-specific score?',
        answer: 'Yes. Open the job-specific resume to see the Job Match Score, an explanation of the strongest alignments and gaps, Matched Skills, and Skills to Address.'
      }
    ]
  },
  {
    title: 'Cover Letter Generator',
    questions: [
      {
        question: 'How does the cover letter generator work?',
        answer: 'Choose the job you are applying for, and Hire Power uses the job details and your resume information to create a tailored first draft. Review the facts and tone, then personalize it before sending.'
      },
      {
        question: 'Can I edit the cover letter after it\'s generated?',
        answer: "Yes. Open the generated cover letter and edit it so the wording sounds like you and includes any important detail the first draft missed."
      },
      {
        question: 'How many cover letters can I create on Free and Pro?',
        answer: 'Free includes up to 3 custom cover letters. Pro includes unlimited cover letters, so you can create a different one for each application.'
      }
    ]
  },
  {
    title: 'Job Match Score',
    questions: [
      {
        question: 'What is the job match score?',
        answer: 'The Job Match Score compares your resume and career information with a job description and highlights matched skills and gaps to address. Use it as preparation guidance, not as a prediction that you will receive an interview or offer.'
      },
      {
        question: 'How many Job Match Scores can I use on Free and Pro?',
        answer: 'Free includes 3 Job Match Scores. Pro includes unlimited Job Match Scores.'
      }
    ]
  },
  {
    title: 'brb (Mobile Resume Builder)',
    questions: [
      {
        question: 'What is brb?',
        answer: "brb, short for best resume builder, is Hire Power's mobile resume builder for people starting without a resume. Answer its questions by typing, and it builds your core resume as you go."
      },
      {
        question: 'How long does it take to build a resume with brb?',
        answer: 'Plan for about 30 minutes to go from no resume to ready to apply. Your exact time depends on how much experience and detail you add.'
      },
      {
        question: 'Do I need a computer?',
        answer: 'No. brb is designed for your phone, so you can build your resume by typing your answers.'
      },
      {
        question: 'Do I get access to the full Hire Power platform through brb?',
        answer: 'Yes. brb creates a core resume inside your Hire Power account, so you can continue working on it in the main platform. Access to AI editing tools still depends on your plan.'
      }
    ]
  },
  {
    title: 'Job Tracker',
    questions: [
      {
        question: 'How does the job tracker work?',
        answer: 'A card is created automatically whenever you make a Job Match Score, job-specific resume, or cover letter, and the job description and documents stay linked to it. You can also use Add Job to create a card manually, then update the card as the application moves forward.'
      },
      {
        question: 'What do the different stages/columns mean?',
        answer: 'Prepping means you are still researching or preparing documents; Applied means the application has been sent; Interview means you are in the interview process; Rejected means the opportunity is no longer moving forward; and Hired means you accepted the role. Hired jobs move into Career Vault so their job details and future wins can help with your next resume.'
      },
      {
        question: 'How do I move a job between stages?',
        answer: "Drag the job card from its current column to Prepping, Applied, Interview, Rejected, or Hired. Move it whenever the application's status changes so the board stays accurate."
      },
      {
        question: 'Can I add notes to a job?',
        answer: 'Yes. Open the job card, add interview dates, contact names, referral details, follow-up reminders, or other information in Notes, then select Done.'
      }
    ]
  },
  {
    title: 'Career Vault',
    questions: [
      {
        question: 'What is the Career Vault for?',
        answer: 'Career Vault is your private, long-term record of the work details you do not want to forget between job searches. It keeps your current role, wins, resumes, and archive together so you are ready for performance reviews and future opportunities.'
      },
      {
        question: 'What should I log in the Vault?',
        answer: 'Log promotions, projects, measurable results, new responsibilities, skills, training, awards, positive feedback, and anything else you may want on a future resume. Add enough context that the achievement will still make sense months later.'
      },
      {
        question: 'How does the Vault help with my next resume?',
        answer: "When you're ready for your next move, Resume Coach can use the job description and wins you saved to update your resume. That means you don't have to remember everything or start from scratch."
      },
      {
        question: 'What happens to my Vault if I downgrade from Pro?',
        answer: 'If you switch from Pro to the $4.99/month Vault plan, your saved career history, resumes, and coaching conversations stay available, along with templates and unlimited downloads. You lose Pro tools such as resume coaching, job customization, interview practice, AI feedback, and creating new resumes.'
      }
    ]
  },
  {
    title: 'Interview Coach',
    questions: [
      {
        question: 'How does Interview Coach work?',
        answer: 'Interview Coach uses your resume and a job description to create tailored practice questions, coach STAR stories, add company research, and give feedback on content and delivery. More FAQs will be added as additional features become available.'
      }
    ]
  },
  {
    title: 'Account & Settings',
    questions: [
      {
        question: 'How do I delete my account?',
        answer: 'Open Profile, scroll to Danger Zone, select Delete Account, and type DELETE to confirm. Deletion is immediate and permanent and removes resumes, coaching conversations, Career Vault achievements, cover letters, job-tracking history, and profile data, so use Export Data first if you need a copy.'
      },
      {
        question: 'How do I change my email or password?',
        answer: 'Open Profile and select Change Password to update your password. Email changes are not currently available through the app.'
      },
      {
        question: 'Is my data private and secure?',
        answer: "Hire Power doesn't sell your information, share it for advertising, or use your career or voice data to train AI models. Stripe handles payment details directly."
      },
      {
        question: 'Who can see my resume and career information?',
        answer: "Your resume and career information aren't public to employers; you choose which downloaded documents to share. Hire Power's authorized service providers can process your information only to operate the platform."
      }
    ]
  },
  {
    title: 'Troubleshooting',
    questions: [
      {
        question: 'The chat submitted before I finished typing (enter key behavior)',
        answer: 'Send the rest of your answer in another message. The coach can use both messages together.'
      },
      {
        question: 'My edits disappeared after coaching',
        answer: "If you saved your edits and they still disappeared, this is unexpected. Please stop editing, note which resume and section were affected, and report the issue immediately through Feedback with the approximate time and steps you took. Avoid making further changes to prevent overwriting any recoverable information."
      },
      {
        question: 'Something looks wrong with my resume formatting',
        answer: 'Try Auto-fit, check the template, font, font size, and date format, then use Preview to see the final layout. If the downloaded resume is still wrong, report it with the template name, browser or device, and a screenshot of both the editor and the exported file.'
      },
      {
        question: 'How do I report a bug?',
        answer: 'Select Feedback and include the steps you took, what you expected, what actually happened, and your browser or device. Add a screenshot for a visual issue or a short screen recording for a problem that depends on a sequence of actions.'
      }
    ]
  }
]

export default helpContent