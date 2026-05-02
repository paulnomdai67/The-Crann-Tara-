const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const { name, business, email, projectType, description } = data;

    // Save to Supabase
    const { error } = await supabase
      .from('leads')
      .insert({ name, business, email, project_type: projectType, description });

    if (error) throw error;

    // Notify Paul
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'paulnomdai67@gmail.com',
      subject: `New Lead: ${name} — ${projectType}`,
      html: `
        <h2>New enquiry from thecranntara.scot</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Business:</strong> ${business}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Project type:</strong> ${projectType}</p>
        <p><strong>Description:</strong> ${description}</p>
      `
    });

    // Confirm to enquirer
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Brief received — The Crann Tara',
      html: `
        <h2>Got it, ${name}.</h2>
        <p>We've received your brief and will come back to you within 24 hours with a clear scope and cost.</p>
        <p>In the meantime, feel free to reply to this email if you have anything to add.</p>
        <br>
        <p>— The Crann Tara</p>
        <p><a href="https://thecranntara.scot">thecranntara.scot</a></p>
      `
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('Lead agent error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
