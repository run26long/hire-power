export default function ModernTemplate({ resume, fontSize = 'medium' }) {
  // Base font sizes: small=9pt, medium=10pt, large=11pt
  const baseSizes = {
    small: {
      name: 14,
      contact: 8,
      heading: 9,
      body: 8,
      micro: 7
    },
    medium: {
      name: 16,
      contact: 9,
      heading: 10,
      body: 9,
      micro: 8
    },
    large: {
      name: 18,
      contact: 10,
      heading: 11,
      body: 10,
      micro: 9
    }
  }

  const sizes = baseSizes[fontSize]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page 1 */}
      <div data-page="1" style={{ 
        width: '8.5in', 
        height: '11in', 
        margin: '0 auto', 
        position: 'relative', 
        backgroundColor: 'white', 
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)', 
        border: '1px solid #ccc',
        overflow: 'hidden'
      }}>
        {/* Purple Sidebar */}
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '2.5in', 
          height: '11in',
          background: 'linear-gradient(to bottom right, #9333ea, #6b21a8)'
        }}></div>
        
        <div style={{ position: 'relative', display: 'flex', height: '11in' }}>
          {/* Left Sidebar */}
          <div style={{ width: '2.5in', padding: '0.4in 0.3in', color: 'white', zIndex: 10 }}>
            {/* Contact */}
            {resume.contact && (
              <div style={{ marginBottom: '0.25in' }}>
                <h2 style={{ fontSize: `${sizes.name}px`, fontWeight: 'bold', marginBottom: '6px', lineHeight: '1.2' }}>
                  {resume.contact.fullName}
                </h2>
                <p style={{ fontSize: `${sizes.contact}px`, marginBottom: '3px', wordBreak: 'break-word' }}>{resume.contact.email}</p>
                <p style={{ fontSize: `${sizes.contact}px` }}>{resume.contact.phone}</p>
              </div>
            )}

            {/* Education */}
            {resume.education && resume.education.length > 0 && (
              <div style={{ marginBottom: '0.25in' }}>
                <h3 style={{ fontSize: `${sizes.heading}px`, fontWeight: 'bold', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Education
                </h3>
                {resume.education.slice(0, 2).map((edu, index) => (
                  <div key={index} style={{ fontSize: `${sizes.body}px`, marginBottom: '8px', lineHeight: '1.2' }}>
                    <p style={{ fontWeight: '600', marginBottom: '2px' }}>{edu.degree}</p>
                    <p style={{ opacity: 0.9, marginBottom: '2px' }}>{edu.school}</p>
                    <p style={{ opacity: 0.75, marginBottom: '2px' }}>{edu.graduationDate}</p>
                    {edu.gpa && <p style={{ marginTop: '2px' }}>GPA: {edu.gpa}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Skills */}
            {resume.skills && resume.skills.length > 0 && (
              <div>
                <h3 style={{ fontSize: `${sizes.heading}px`, fontWeight: 'bold', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Skills
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {resume.skills.map((skill, index) => (
                    <span key={index} style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: '3px 6px', borderRadius: '3px', fontSize: `${sizes.micro}px`, lineHeight: '1.2' }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Content */}
          <div style={{ flex: 1, padding: '0.4in 0.3in' }}>
            {/* Summary */}
            {resume.summary && (
              <div style={{ marginBottom: '0.2in' }}>
                <h3 style={{ fontSize: `${sizes.heading}px`, fontWeight: 'bold', color: '#7c3aed', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Professional Summary
                </h3>
                <p style={{ fontSize: `${sizes.body}px`, color: '#374151', lineHeight: '1.4' }}>{resume.summary}</p>
              </div>
            )}

            {/* Experience - Page 1 */}
            {resume.experience && resume.experience.length > 0 && (
              <div>
                <h3 style={{ fontSize: `${sizes.heading}px`, fontWeight: 'bold', color: '#7c3aed', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Work Experience
                </h3>
                {resume.experience.slice(0, 2).map((job, index) => (
                  <div key={index} style={{ marginBottom: '0.15in' }}>
                    <h4 style={{ fontSize: `${sizes.body}px`, fontWeight: 'bold', marginBottom: '2px' }}>{job.title}</h4>
                    <p style={{ fontSize: `${sizes.micro}px`, color: '#6b7280', marginBottom: '3px' }}>
                      {job.company} | {job.startDate} - {job.endDate}
                    </p>
                    {job.summary && (
                      <p style={{ fontSize: `${sizes.micro}px`, color: '#6b7280', fontStyle: 'italic', marginBottom: '4px' }}>{job.summary}</p>
                    )}
                    {job.achievements && job.achievements.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: '10px', listStyle: 'none' }}>
                        {job.achievements.slice(0, 4).map((achievement, i) => (
                          <li key={i} style={{ fontSize: `${sizes.micro}px`, color: '#374151', marginBottom: '3px', lineHeight: '1.3', position: 'relative', paddingLeft: '6px' }}>
                            <span style={{ position: 'absolute', left: 0 }}>•</span>
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
        </div>
      </div>

      {/* Page 2 - If more than 2 jobs */}
      {resume.experience && resume.experience.length > 2 && (
        <div data-page="2" style={{ 
          width: '8.5in', 
          height: '11in', 
          margin: '0 auto', 
          position: 'relative', 
          backgroundColor: 'white', 
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)', 
          border: '1px solid #ccc',
          overflow: 'hidden'
        }}>
          {/* Purple Sidebar - Page 2 */}
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '2.5in', 
            height: '11in',
            background: 'linear-gradient(to bottom right, #9333ea, #6b21a8)'
          }}></div>
          
          <div style={{ position: 'relative', display: 'flex', height: '11in' }}>
            {/* Left Sidebar - Continued */}
            <div style={{ width: '2.5in', padding: '0.4in 0.3in', color: 'white', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: `${sizes.name}px`, fontWeight: 'bold', opacity: 0.3, textAlign: 'center', lineHeight: '1.3' }}>
                {resume.contact?.fullName}
              </p>
            </div>

            {/* Right Content - Continued */}
            <div style={{ flex: 1, padding: '0.4in 0.3in' }}>
              <h3 style={{ fontSize: `${sizes.heading}px`, fontWeight: 'bold', color: '#7c3aed', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Work Experience (Continued)
              </h3>
              {resume.experience.slice(2).map((job, index) => (
                <div key={index} style={{ marginBottom: '0.15in' }}>
                  <h4 style={{ fontSize: `${sizes.body}px`, fontWeight: 'bold', marginBottom: '2px' }}>{job.title}</h4>
                  <p style={{ fontSize: `${sizes.micro}px`, color: '#6b7280', marginBottom: '3px' }}>
                    {job.company} | {job.startDate} - {job.endDate}
                  </p>
                  {job.summary && (
                    <p style={{ fontSize: `${sizes.micro}px`, color: '#6b7280', fontStyle: 'italic', marginBottom: '4px' }}>{job.summary}</p>
                  )}
                  {job.achievements && job.achievements.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: '10px', listStyle: 'none' }}>
                      {job.achievements.slice(0, 4).map((achievement, i) => (
                        <li key={i} style={{ fontSize: `${sizes.micro}px`, color: '#374151', marginBottom: '3px', lineHeight: '1.3', position: 'relative', paddingLeft: '6px' }}>
                          <span style={{ position: 'absolute', left: 0 }}>•</span>
                          {achievement}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}