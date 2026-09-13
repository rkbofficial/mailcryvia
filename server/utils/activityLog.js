function logActivity(db, { type, actorEmail = null, targetEmail = null, detail = {} }) {
  try {
    db.prepare('INSERT INTO admin_activity_log (type, actor_email, target_email, detail) VALUES (?,?,?,?)')
      .run(type, actorEmail ? '[REDACTED]' : null, targetEmail ? '[REDACTED]' : null, JSON.stringify(detail));
  } catch (_) {}
}

module.exports = { logActivity };
