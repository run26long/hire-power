export default function JimTemplate({ resume, fontSize = 'medium' }) {
  const baseSizes = {
    small: { name: 16, contact: 8, sectionHeader: 9, jobTitle: 9, body: 9, micro: 8 },
    medium: { name: 18, contact: 9, sectionHeader: 10, jobTitle: 10, body: 10, micro: 9 },
    large: { name: 20, contact: 10, sectionHeader: 11, jobTitle: 11, body: 11, micro: 10 }
  }

  const sizes = baseSizes[fontSize]

  return (
    <div>
      <div data-page="1" style={{ width: '8.5in', height: '11in', margin: '0 auto', backgroundColor: 'white', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', border: '1px solid #ccc', overflow: 'hidden', padding: '0.75in 1in', marginBottom: '20px' }}>
        {resume.contact && (
          <div style={{ textAlign: 'center', marginBottom: '0.15in', paddingBottom: '0.1in', borderBottom: '2px solid #000' }}>
            <h1 style={{ fontSize: `${sizes.name}px`, fontWeight: 'bold', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              {resume.contact.fullName}
            </h1>
            <p style={{ fontSize: `${sizes.contact}px`, margin: 0 }}>
              {resume.contact.phone} | {resume.contact.email}
            </p>
          </div>
        )}
        
        <div style={{ textAlign: 'center', marginBottom: '0.15in' }}>
          <h2 style={{ fontSize: `${sizes.sectionHeader + 1}px`, fontWeight: 'bold', margin: 0 }}>
            Entertainment Professional | Event Coordinator
          </h2>
        </div>

        {resume.summary && (
          <div style={{ marginBottom: '0.15in' }}>
            <p style={{ fontSize: `${sizes.body}px`, lineHeight: '1.4', margin: 0, textAlign: 'justify' }}>
              {resume.summary}
            </p>
          </div>
        )}

        {resume.skills && resume.skills.length > 0 && (
          <div style={{ marginBottom: '0.15in' }}>
            <h3 style={{ fontSize: `${sizes.sectionHeader}px`, fontWeight: 'bold', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Core Competencies
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 0.3in' }}>
              {resume.skills.slice(0, 16).map((skill, index) => (
                <div key={index} style={{ marginBottom: '2px' }}>
                  <p style={{ fontSize: `${sizes.micro}px`, margin: 0, lineHeight: '1.3' }}>• {skill}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {resume.experience && resume.experience.length > 0 && (
          <div>
            <h3 style={{ fontSize: `${sizes.sectionHeader}px`, fontWeight: 'bold', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Professional Experience
            </h3>
            {resume.experience.slice(0, 1).map((job, index) => (
              <div key={index} style={{ marginBottom: '0.15in' }}>
                <p style={{ fontSize: `${sizes.jobTitle}px`, fontWeight: 'bold', margin: '0 0 2px 0', textTransform: 'uppercase' }}>
                  {job.title} | {job.company} | {job.startDate} - {job.endDate}
                </p>
                {job.summary && (
                  <p style={{ fontSize: `${sizes.micro}px`, fontStyle: 'italic', margin: '0 0 8px 0', lineHeight: '1.3' }}>
                    {job.summary}
                  </p>
                )}
                {job.achievements && job.achievements.length > 0 && (
                  <ul style={{ margin: '0', paddingLeft: '18px', listStyleType: 'disc' }}>
                    {job.achievements.map((achievement, i) => (
                      <li key={i} style={{ fontSize: `${sizes.micro}px`, marginBottom: '4px', lineHeight: '1.3' }}>
                        {achievement}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {resume.experience && resume.experience.length > 1 && (
        <div data-page="2" style={{ width: '8.5in', height: '11in', margin: '0 auto', backgroundColor: 'white', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', border: '1px solid #ccc', overflow: 'hidden', padding: '0.75in 1in' }}>
          <div style={{ textAlign: 'center', marginBottom: '0.15in', paddingBottom: '0.1in', borderBottom: '1px solid #ccc' }}>
            <h2 style={{ fontSize: `${sizes.name - 2}px`, fontWeight: 'bold', margin: 0, textTransform: 'uppercase' }}>
              {resume.contact?.fullName} - PAGE TWO
            </h2>
          </div>

          <div>
            <h3 style={{ fontSize: `${sizes.sectionHeader}px`, fontWeight: 'bold', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Professional Experience
            </h3>
            {resume.experience.slice(1).map((job, index) => (
              <div key={index} style={{ marginBottom: '0.15in' }}>
                <p style={{ fontSize: `${sizes.jobTitle}px`, fontWeight: 'bold', margin: '0 0 2px 0', textTransform: 'uppercase' }}>
                  {job.title} | {job.company} | {job.startDate} - {job.endDate}
                </p>
                {job.summary && (
                  <p style={{ fontSize: `${sizes.micro}px`, fontStyle: 'italic', margin: '0 0 8px 0', lineHeight: '1.3' }}>
                    {job.summary}
                  </p>
                )}
                {job.achievements && job.achievements.length > 0 && (
                  <ul style={{ margin: '0', paddingLeft: '18px', listStyleType: 'disc' }}>
                    {job.achievements.map((achievement, i) => (
                      <li key={i} style={{ fontSize: `${sizes.micro}px`, marginBottom: '4px', lineHeight: '1.3' }}>
                        {achievement}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {resume.education && resume.education.length > 0 && (
            <div style={{ marginTop: '0.2in' }}>
              <h3 style={{ fontSize: `${sizes.sectionHeader}px`, fontWeight: 'bold', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Education
              </h3>
              {resume.education.map((edu, index) => (
                <div key={index} style={{ fontSize: `${sizes.micro}px`, marginBottom: '4px', lineHeight: '1.3' }}>
                  <p style={{ fontWeight: 'bold', margin: 0, display: 'inline' }}>{edu.degree}</p>
                  {edu.school && <span> | {edu.school}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}