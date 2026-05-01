const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async function(event, context) {
  try {
    // Fetch the live site
    const siteRes = await fetch('https://thecranntara.scot');
    const html = await siteRes.text();

    // Strip HTML to get readable text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 8000);

    // Ask Claude to analyse it
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are an SEO analyst. Analyse this website content for the target keyword "AI app developer Scotland".

Website content:
${text}

Respond ONLY with valid JSON in this exact format:
{
  "overall_score": <0-100>,
  "keyword_in_title": <true/false>,
  "keyword_in_meta": <true/false>,
  "keyword_in_h1": <true/false>,
  "title_tag_ok": <true/false>,
  "meta_desc_ok": <true/false>,
  "h1_ok": <true/false>,
  "page_word_count": <number>,
  "issues": ["issue 1", "issue 2", "issue 3"],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}`
        }]
      })
    });

    const claudeData = await claudeRes.json();
    const reportText = claudeData.content?.[0]?.text || '{}';
    const report = JSON.parse(reportText);

    // Get week starting date (last Monday)
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Save to Supabase
    const { error } = await supabase
      .from('seo_reports')
      .insert({
        week_starting: weekStartStr,
        overall_score: report.overall_score,
        target_keyword: 'AI app developer Scotland',
        title_tag_ok: report.title_tag_ok,
        meta_desc_ok: report.meta_desc_ok,
        h1_ok: report.h1_ok,
        keyword_in_title: report.keyword_in_title,
        keyword_in_meta: report.keyword_in_meta,
        keyword_in_h1: report.keyword_in_h1,
        page_word_count: report.page_word_count,
        issues: report.issues,
        recommendations: report.recommendations,
        raw_report: reportText
      });

    if (error) throw error;

    console.log('Marketing Agent: SEO report saved successfully');
    return { statusCode: 200, body: JSON.stringify({ success: true, score: report.overall_score }) };

  } catch (err) {
    console.error('Marketing Agent error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
