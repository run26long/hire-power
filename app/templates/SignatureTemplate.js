// SignatureTemplate.js — Airy centered, shaded section bands | Pro tier
import { formatDate, formatDateRange, getSkillsDisplay, hexToRgba } from './templateUtils';

export default function SignatureTemplate({ resumeData, font, fontSize, spacing = 1, accentColor, dateFormat = 'short' }) {
  if (!resumeData) return null;
  const skills = getSkillsDisplay(resumeData);
  const base = fontSize || 11;
  const sp = spacing || 1;
  const color = accentColor || '#5b4fcf';
  const fontFamily = font || 'EB Garamond';
  const px = (n) => `${Math.round(n * sp)}px`;
  const professionalTitle = resumeData.professionalTitle || resumeData.experience?.[0]?.title || '';

  const allSkillValues = Object.values(skills).flat();
  const hasMoreSkills = allSkillValues.length > 0;

  const s = {
    page: {
      fontFamily,
      fontSize: `${base}pt`,
      lineHeight: '1.2',
      color: '#1a1a1a',
      padding: `${px(36)} ${px(43)}`,
      background: '#fff',
      width: '100%',
      boxSizing: 'border-box',
    },
    hdr: {
      textAlign: 'center',
      paddingBottom: px(10),
      marginBottom: px(4),
    },
    name: {
      fontFamily,
      fontSize: '24pt',
      fontWeight: '700',
      letterSpacing: '3px',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      marginBottom: px(4),
      lineHeight: '1.1',
      textAlign: 'center',
    },
    title: {
      fontFamily,
      fontSize: `${base}pt`,
      color: color,
      letterSpacing: '1px',
      textAlign: 'center',
      marginBottom: px(8),
      lineHeight: '1.2',
    },
    hdrRule: {
      border: 'none',
      borderBottom: '1px solid #ccc',
      margin: `${px(8)} 0`,
    },
    contact: {
      fontFamily,
      fontSize: `${base - 1}pt`,
      color: '#555',
      textAlign: 'center',
      lineHeight: '1.4',
      letterSpacing: '0.3px',
    },
    section: {
      marginTop: px(16),
    },
    sh: {
      fontFamily,
      fontSize: `${base}pt`,
      fontWeight: '700',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      background: hexToRgba(color, 0.133),
      padding: `${px(3)} ${px(6)}`,
      textAlign: 'center',
      marginBottom: px(8),
      marginTop: '0',
      lineHeight: '1.2',
    },
    entry: { marginBottom: px(12) },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
    jt: { fontFamily, fontWeight: '700', fontSize: `${base}pt`, lineHeight: '1.2', color: '#1a1a1a' },
    dt: { fontFamily, fontSize: `${base}pt`, color: '#555', lineHeight: '1.2' },
    co: { fontFamily, fontSize: `${base}pt`, color: '#555', marginBottom: px(4), lineHeight: '1.2' },
    li: { fontFamily, margin: `${px(2)} 0`, fontSize: `${base}pt`, display: 'flex', alignItems: 'flex-start', gap: '6px', lineHeight: '1.2' },
    sm: { fontFamily, fontSize: `${base}pt`, color: '#444', margin: `${px(3)} 0`, lineHeight: '1.2' },
    body: { fontFamily, fontSize: `${base}pt`, color: '#333', margin: `0 0 ${px(4)}`, lineHeight: '1.2' },
  };

  const contactParts = [
    resumeData.phone,
    resumeData.email,
    resumeData.location,
    resumeData.linkedin,
    resumeData.portfolio,
  ].filter(Boolean);

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.hdr}>
        <div style={s.name}>{resumeData.fullName}</div>
        {professionalTitle && (
          <div style={s.title}>{professionalTitle}</div>
        )}
        <hr style={s.hdrRule} />
        <div style={s.contact}>
          {contactParts.join(' | ')}
        </div>
      </div>

      {/* Summary */}
      {resumeData.summary && !resumeData.hideSummary && (
        <div style={s.section}>
          <div style={s.sh}>{resumeData.sectionTitles?.summary || 'Professional Summary'}</div>
          <p style={s.body}>{resumeData.summary}</p>

        </div>
      )}

      {/* Experience */}
      {resumeData.experience?.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Experience</div>
          {resumeData.experience.map((job, i) => (
            <div key={i} style={i < resumeData.experience.length - 1 ? s.entry : {}}>
              <div style={s.row}>
                <span style={s.jt}>{job.title}</span>
                <span style={s.dt}>{formatDateRange(job.startDate, job.endDate, job.current, dateFormat)}</span>
              </div>
              <div style={s.co}>{[job.company, job.location].filter(Boolean).join(' | ')}</div>
              {job.summary && !job.summaryDismissed && <p style={s.sm}>{job.summary}</p>}
              {job.bullets?.length > 0 && (
                <div style={{ marginTop: px(3) }}>
                  {job.bullets.map((b, k) => (
                    <div key={k} style={s.li}>
                      <span style={{ flexShrink: 0 }}>•</span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {resumeData.education?.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Education</div>
          {resumeData.education.map((ed, i) => (
            <div key={i} style={i < resumeData.education.length - 1 ? s.entry : {}}>
              <div style={s.row}>
                <span style={s.jt}>{ed.school}</span>
                <span style={s.dt}>{formatDate(ed.graduationDate, dateFormat)}</span>
              </div>
              <div style={s.co}>{[ed.degree, ed.field].filter(Boolean).join(', ')}</div>
              {ed.lines?.map((l, k) => <div key={k} style={{ fontFamily, fontSize: `${base}pt`, color: '#333', lineHeight: '1.3' }}>{l}</div>)}
            </div>
          ))}
        </div>
      )}

      {/* Skills — only renders if more than 9 skills or categories exist */}
      {hasMoreSkills && allSkillValues.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Skills</div>
          {Object.entries(skills).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: px(4) }}>
              {Object.keys(skills).length > 1
                ? <><span style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{cat}: </span>
                    <span style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>{items.join(' • ')}</span></>
                : <span style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>{items.join(' • ')}</span>
              }
            </div>
          ))}
        </div>
      )}

      {/* Certifications */}
      {resumeData.certifications?.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Certifications</div>
          {resumeData.certifications.map((c, i) => (
            <div key={i} style={i < resumeData.certifications.length - 1 ? s.entry : {}}>
              <div style={{ fontFamily, fontSize: `${base}pt` }}>
                <strong>{c.name}</strong>{c.details ? ` | ${c.details}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Volunteer */}
      {resumeData.volunteer?.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Volunteer Experience</div>
          {resumeData.volunteer.map((v, i) => (
            <div key={i} style={i < resumeData.volunteer.length - 1 ? s.entry : {}}>
              <div style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{v.organization}</div>
              <div style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{v.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Projects */}
      {resumeData.projects?.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Projects</div>
          {resumeData.projects.map((p, i) => (
            <div key={i} style={i < resumeData.projects.length - 1 ? s.entry : {}}>
              <div style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{p.name}{p.link ? ` | ${p.link}` : ''}</div>
              <div style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{p.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Additional Information */}
      {resumeData.additionalInfo?.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Additional Information</div>
          {resumeData.additionalInfo.map((item, i) => (
            <div key={i} style={i < resumeData.additionalInfo.length - 1 ? { marginBottom: px(3) } : {}}>
              <div style={{ fontFamily, fontSize: `${base}pt`, lineHeight: '1.3', display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                <strong>{item.label}</strong>
                {item.detail && <span style={{ color: '#555' }}>| {item.detail}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Languages */}
      {resumeData.languages?.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Languages</div>
          <div style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>
            {resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' • ')}
          </div>
        </div>
      )}
    </div>
  );
}