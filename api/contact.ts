type ContactPayload = {
  name?: string;
  email?: string;
  linkedinUrl?: string;
  company?: string;
  dataInterests?: string[];
  requirements?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === "string");
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  const fromEmail =
    process.env.CONTACT_SENDER_EMAIL || process.env.CONTACT_FROM_EMAIL;

  const missing: string[] = [];
  if (!apiKey) missing.push("RESEND_API_KEY");
  if (!toEmail) missing.push("CONTACT_TO_EMAIL");
  if (!fromEmail) missing.push("CONTACT_SENDER_EMAIL");

  if (missing.length > 0) {
    res
      .status(500)
      .send(`Email service is not configured. Missing: ${missing.join(", ")}`);
    return;
  }

  let body: ContactPayload | null = null;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    body = null;
  }

  if (!body) {
    res.status(400).send("Invalid JSON body.");
    return;
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";

  if (!name || !email) {
    res.status(400).send("Name and email are required.");
    return;
  }

  const dataInterests = ensureStringArray(body.dataInterests);
  const subjectBase = body.company ? `${name} · ${body.company}` : name;
  const subject = `New contact form: ${subjectBase}`;

  const detailLines: Array<[string, string]> = [
    ["Name", name],
    ["Email", email],
    ["Company", body.company || "-"],
    ["LinkedIn", body.linkedinUrl || "-"],
    ["Interests", dataInterests.length > 0 ? dataInterests.join(", ") : "-"],
    ["Requirements", body.requirements || "-"],
  ];

  const textBody = detailLines.map(([label, value]) => `${label}: ${value}`).join("\n");
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2 style="margin: 0 0 12px;">New Contact Form Submission</h2>
      <table style="border-collapse: collapse;">
        ${detailLines
          .map(
            ([label, value]) => `
              <tr>
                <td style="padding: 4px 12px 4px 0; font-weight: 600; vertical-align: top;">
                  ${escapeHtml(label)}
                </td>
                <td style="padding: 4px 0;">
                  ${escapeHtml(value)}
                </td>
              </tr>
            `,
          )
          .join("")}
      </table>
    </div>
  `;

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
      from: fromEmail,
        to: [toEmail],
        subject,
        html: htmlBody,
        text: textBody,
        reply_to: email,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      res.status(502).send(errorText || "Failed to send email.");
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : "Unexpected error");
  }
}
