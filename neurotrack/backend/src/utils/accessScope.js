function patientScope(user, alias = 'p', startIndex = 1) {
  if (user.role === 'admin') {
    return { sql: 'TRUE', params: [], nextIndex: startIndex };
  }

  if (user.role === 'doctor') {
    return {
      sql: `(${alias}.primary_doctor_id = $${startIndex} OR EXISTS (
        SELECT 1 FROM user_patient_access upa
        WHERE upa.patient_id = ${alias}.id
          AND upa.user_id = $${startIndex}
          AND upa.revoked_at IS NULL
      ))`,
      params: [user.id],
      nextIndex: startIndex + 1,
    };
  }

  return {
    sql: `EXISTS (
      SELECT 1 FROM user_patient_access upa
      WHERE upa.patient_id = ${alias}.id
        AND upa.user_id = $${startIndex}
        AND upa.revoked_at IS NULL
    )`,
    params: [user.id],
    nextIndex: startIndex + 1,
  };
}

module.exports = { patientScope };
