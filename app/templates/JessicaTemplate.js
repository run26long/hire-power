export default function JessicaTemplate({ resume, fontSize = 'medium' }) {
  // Font sizes: small=9pt, medium=10pt, large=11pt
  const baseSizes = {
    small: {
      name: 18,
      title: 12,
      sectionHeader: 9,
      body: 9,
      micro: 8
    },
    medium: {
      name: 20,
      title: 13,
      sectionHeader: 10,
      body: 10,
      micro: 9
    },
    large: {
      name: 22,
      title: 14,
      sectionHeader: 11,
      body: 11,
      micro: 10
    }
  }

  const sizes = baseSizes[fontSize]

  return (
    <div data-page="1" style={{ 
      width: '8.5in', 
      height: '11in', 
      margin: '0 auto', 
      backgroundColor: 'white', 
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)', 
      border: '1px solid #ccc',
      overflow: 'hidden',
      display: 'flex',
      padding: '0.6in 0.5in'
    }}>
      {/* Left Main Content */}
      <div style={{ 
        flex: 1, 
        paddingRight: '0.3in',
        borderRight: '1px solid #ddd',
        overflow: 'hidden'
      }}>
        {/* Header */}
        {resume.contact && (
          <div style={{ marginBottom: '0.2in' }}>
            <h1 style={{ 
              fontSize: `${sizes.name}px`, 
              fontWeight: 'bold', 
              margin: '0 0 4px 0',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              {resume.contact.fullName}
            </h1>
            <p style={{ 
              fontSize: `${sizes.title}px`, 
              margin: '0 0 12px 0',
              color: '#333'
            }}>
              Entertainment Professional | Event Coordinator
            </p>
          </div>
        )}

        {/* Professional Summary */}
        {resume.summary && (
          <div style={{ marginBottom: '0.2in' }}>
            <p style={{ 
              fontSize: `${sizes.body}px`, 
              lineHeight: '1.4',
              margin: 0,
              textAlign: 'justify'
            }}>
              {resume.summary}
            </p>
          </div>
        )}

        {/* Professional Experience */}
        {resume.experience && resume.experience.length > 0 && (
          <div>
            <h3 style={{ 
              fontSize: `${sizes.sectionHeader}px`, 
              fontWeight: 'bold', 
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Professional Experience
            </h3>
            {resume.experience.map((job, index) => (
              <div key={index} style={{ marginBottom: '0.15in' }}>
                <p style={{ 
                  fontSize: `${sizes.body}px`, 
                  fontWeight: 'bold', 
                  margin: '0 0 2px 0'
                }}>
                  {job.title} | {job.company} | {job.startDate} - {job.endDate}
                </p>
                {job.summary && (
                  <p style={{ 
                    fontSize: `${sizes.micro}px`, 
                    fontStyle: 'italic',
                    margin: '0 0 6px 0',
                    lineHeight: '1.3'
                  }}>
                    {job.summary}
                  </p>
                )}
                {job.achievements && job.achievements.length > 0 && (
                  <ul style={{ 
                    margin: '0',
                    paddingLeft: '14px',
                    listStyleType: 'disc'
                  }}>
                    {job.achievements.map((achievement, i) => (
                      <li key={i} style={{ 
                        fontSize: `${sizes.micro}px`, 
                        marginBottom: '3px',
                        lineHeight: '1.3'
                      }}>
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

      {/* Right Sidebar */}
      <div style={{ 
        width: '2.75in', 
        paddingLeft: '0.3in'
      }}>
        {/* Core Competencies */}
        <div style={{ marginBottom: '0.25in' }}>
          <h3 style={{ 
            fontSize: `${sizes.sectionHeader}px`, 
            fontWeight: 'bold', 
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Core Competencies:
          </h3>
          <ul style={{ 
            margin: 0, 
            paddingLeft: '14px',
            listStyleType: 'disc'
          }}>
            {resume.skills && resume.skills.slice(0, 16).map((skill, index) => (
              <li key={index} style={{ 
                fontSize: `${sizes.micro}px`, 
                marginBottom: '3px',
                lineHeight: '1.3'
              }}>
                {skill}
              </li>
            ))}
          </ul>
        </div>

        {/* Education */}
        {resume.education && resume.education.length > 0 && (
          <div style={{ marginBottom: '0.25in' }}>
            <h3 style={{ 
              fontSize: `${sizes.sectionHeader}px`, 
              fontWeight: 'bold', 
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Education:
            </h3>
            {resume.education.map((edu, index) => (
              <div key={index} style={{ 
                fontSize: `${sizes.micro}px`,
                marginBottom: '8px',
                lineHeight: '1.3'
              }}>
                <p style={{ fontWeight: 'bold', margin: 0 }}>{edu.school}</p>
                <p style={{ margin: 0 }}>{edu.degree}</p>
                {edu.graduationDate && <p style={{ margin: 0 }}>{edu.graduationDate}</p>}
                {edu.gpa && <p style={{ margin: 0 }}>GPA: {edu.gpa}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Contact */}
        {resume.contact && (
          <div>
            <h3 style={{ 
              fontSize: `${sizes.sectionHeader}px`, 
              fontWeight: 'bold', 
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              Contact:
            </h3>
            <div style={{ fontSize: `${sizes.micro}px`, lineHeight: '1.4' }}>
              <p style={{ margin: '0 0 3px 0' }}>{resume.contact.phone}</p>
              <p style={{ margin: '0 0 3px 0', wordBreak: 'break-word' }}>{resume.contact.email}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}