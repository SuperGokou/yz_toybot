"""
Email service for sending daily reports.
"""

import os
from typing import Dict, Optional


async def send_report_email(report: Dict, parent_profile: Dict):
    """
    Send daily report via email.
    
    Currently logs the email. Implement actual sending with SMTP or service.
    """
    if not parent_profile:
        print("[Email] No parent profile, skipping email")
        return
    
    email = parent_profile.get("parent_email")
    parent_name = parent_profile.get("parent_name", "Parent")
    child_name = report.get("child_name", "Your child")
    
    # Format email content
    email_body = f"""
========== DAILY REPORT EMAIL ==========
To: {email}
Subject: VV's Daily Report for {child_name} - {report['date']}

Hi {parent_name}!

Here's what {child_name} learned today with VV:

Summary:
{report['summary']}

Topics Discussed:
{', '.join(report.get('topics_discussed', []))}

Skills Practiced:
{', '.join(report.get('skills_practiced', []))}

Mood: {report.get('mood', 'happy')}

Recommendations:
{chr(10).join('- ' + r for r in report.get('recommendations', []))}

Stats: {report.get('interaction_count', 0)} interactions, ~{report.get('total_minutes', 0)} minutes

Keep up the great learning!
- VV
========================================
"""
    
    print(email_body)
    
    # Implement actual email sending
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    
    if smtp_server and smtp_user and smtp_pass:
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            smtp_port = int(os.getenv("SMTP_PORT", "587"))
            
            msg = MIMEMultipart('alternative')
            msg['From'] = smtp_user
            msg['To'] = email
            msg['Subject'] = f"VV's Daily Report for {child_name} - {report['date']}"
            
            # Create HTML version
            html_body = format_html_email(report, parent_name, child_name)
            msg.attach(MIMEText(email_body, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))
            
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
            
            print(f"[Email] Sent report to {email}")
            
        except Exception as e:
            print(f"[Email] Error sending: {e}")
    else:
        print("[Email] SMTP not configured, email logged only")


def format_html_email(report: Dict, parent_name: str, child_name: str) -> str:
    """Format email as HTML."""
    topics = ''.join(f'<li>{t}</li>' for t in report.get('topics_discussed', []))
    skills = ''.join(f'<li>{s}</li>' for s in report.get('skills_practiced', []))
    recommendations = ''.join(f'<li>{r}</li>' for r in report.get('recommendations', []))
    
    return f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: 'Nunito', Arial, sans-serif; background: #fefdfb; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }}
        h1 {{ color: #FF9F1C; }}
        h2 {{ color: #5D4E37; font-size: 18px; margin-top: 20px; }}
        p {{ color: #5D4E37; line-height: 1.6; }}
        ul {{ color: #5D4E37; }}
        .stats {{ background: #FFF7ED; padding: 12px; border-radius: 8px; margin-top: 20px; }}
        .mood {{ display: inline-block; background: #FFD166; padding: 4px 12px; border-radius: 20px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>VV's Daily Report</h1>
        <p>Hi {parent_name}!</p>
        <p>Here's what {child_name} learned today with VV:</p>
        
        <h2>Summary</h2>
        <p>{report['summary']}</p>
        
        <h2>Topics Discussed</h2>
        <ul>{topics}</ul>
        
        <h2>Skills Practiced</h2>
        <ul>{skills}</ul>
        
        <h2>Mood</h2>
        <p><span class="mood">{report.get('mood', 'happy')}</span></p>
        
        <h2>Recommendations</h2>
        <ul>{recommendations}</ul>
        
        <div class="stats">
            <strong>Stats:</strong> {report.get('interaction_count', 0)} interactions, ~{report.get('total_minutes', 0)} minutes
        </div>
        
        <p style="margin-top: 24px;">Keep up the great learning!<br>- VV</p>
    </div>
</body>
</html>
"""
