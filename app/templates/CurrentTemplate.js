// CurrentTemplate.js — Clean centered header, ruled section dividers | Free tier
import { formatDate, formatDateRange, getSkillsDisplay } from './templateUtils';

export default function CurrentTemplate({ resumeData, font, fontSize, spacing = 1, accentColor, dateFormat = 'short' }) {
  if (!resumeData) return null;
  const skills = getSkillsDisplay(resumeData);
  const base = fontSize || 11;
  const sp = spacing || 1;
  const fontFamily = font || 'Calibri, Arial, sans-serif';
  const px = (n) => `${Math.round(n * sp)}px`;
  const professionalTitle = resumeData.professionalTitle || resumeData.experience?.[0]?.title || '';

  const s = {
    page: {
      fontFamily,
      fontSize: `${base}pt`,
      lineHeight: '1.25',
      color: '#1a1a1a',
      padding: `${px(36)} ${px(56)}`,
      background: '#fff',
      width: '100%',
      boxSizing: 'border-box',
    },
    nameBlock: {
      textAlign: 'center',
      marginBottom: '0',
    },
    name: {
      fontFamily,
      fontSize: '22pt',
      fontWeight: '700',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      marginBottom: px(3),
      lineHeight: '1.1',
      textAlign: 'center',
    },
    title: {
      fontFamily,
      fontSize: `${base}pt`,
      fontWeight: '400',
      color: '#555',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      textAlign: 'center',
      marginBottom: px(6),
      lineHeight: '1.2',
    },
   rule: {
      border: 'none',
      borderBottom: '1px solid #bbb',
      margin: '0',
    },
    headerGap: {
      marginBottom: px(14),
    },
    contact: {
      fontFamily,
      fontSize: `${base - 1}pt`,
      color: '#555',
      textAlign: 'center',
      lineHeight: '1.3',
      letterSpacing: '0.2px',
      padding: `${px(6)} 0`,
    },
    section: {
      marginTop: '0',
    },
    sectionDivider: {
      border: 'none',
      borderBottom: '1px solid #bbb',
      margin: `${px(12)} 0 ${px(12)} 0`,
    },
    sh: {
      fontFamily,
      fontSize: `${base + 1}pt`,
      fontWeight: '700',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      marginBottom: px(8),
      marginTop: '0',
      lineHeight: '1.2',
    },
    entry: { marginBottom: px(10) },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
    jt: { fontFamily, fontWeight: '700', fontSize: `${base}pt`, lineHeight: '1.2', color: '#1a1a1a' },
    dt: { fontFamily, fontSize: `${base}pt`, color: '#555', lineHeight: '1.2' },
    co: { fontFamily, fontSize: `${base}pt`, color: '#555', marginBottom: px(2), lineHeight: '1.2' },
    li: { fontFamily, margin: `${px(1)} 0`, fontSize: `${base}pt`, display: 'flex', alignItems: 'flex-start', gap: '6px', lineHeight: '1.25' },
    sm: { fontFamily, fontSize: `${base}pt`, color: '#444', margin: `${px(2)} 0`, lineHeight: '1.25' },
    body: { fontFamily, fontSize: `${base}pt`, color: '#333', margin: `0 0 ${px(3)}`, lineHeight: '1.25' },
  };

  const contactParts = [
    resumeData.phone,
    resumeData.email,
    resumeData.location,
    resumeData.linkedin,
    resumeData.portfolio,
  ].filter(Boolean);

  // Helper to render a section with a divider rule above it
  const Section = ({ title, children }) => (
    <div style={s.section}>
      <hr style={s.sectionDivider} />
      <div style={s.sh}>{title}</div>
      {children}
    </div>
  );

  return (
    <div style={s.page}>
      {/* Header — name and title above rules, contact sandwiched between rules */}
      <div style={s.nameBlock}>
        <div style={s.name}>{resumeData.fullName}</div>
        {professionalTitle && <div style={s.title}>{professionalTitle}</div>}
      </div>
      <hr style={s.rule} />
      <div style={s.contact}>{contactParts.join(' | ')}</div>
      <hr style={s.rule} />
      <div style={s.headerGap} />

      {/* Summary */}
      {resumeData.summary && !resumeData.hideSummary && (
        <div style={{ ...s.section, marginTop: px(18) }}>
          <div style={s.sh}>{resumeData.sectionTitles?.summary || 'Professional Summary'}</div>
          <p style={s.body}>{resumeData.summary}</p>
        </div>
      )}

      {/* Experience */}
      {resumeData.experience?.length > 0 && (
        <Section title="Experience">
          {resumeData.experience.map((job, i) => (
            <div key={i} style={i < resumeData.experience.length - 1 ? s.entry : {}}>
              <div style={s.row}>
                <span style={s.jt}>{job.title}</span>
                <span style={s.dt}>{formatDateRange(job.startDate, job.endDate, job.current, dateFormat)}</span>
              </div>
              <div style={s.co}>{[job.company, job.location].filter(Boolean).join(' | ')}</div>
              {job.summary && !job.summaryDismissed && <p style={s.sm}>{job.summary}</p>}
              {job.bullets?.length > 0 && (
                <div style={{ marginTop: px(2) }}>
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
        </Section>
      )}

      {/* Education */}
      {resumeData.education?.length > 0 && (
        <Section title="Education">
          {resumeData.education.map((ed, i) => (
            <div key={i} style={i < resumeData.education.length - 1 ? s.entry : {}}>
              <div style={s.row}>
                <span style={s.jt}>{ed.school}</span>
                <span style={s.dt}>{formatDate(ed.graduationDate, dateFormat)}</span>
              </div>
              <div style={s.co}>{[ed.degree, ed.field].filter(Boolean).join(', ')}</div>
              {ed.lines?.map((l, k) => (
                <div key={k} style={{ fontFamily, fontSize: `${base}pt`, color: '#333', lineHeight: '1.25' }}>{l}</div>
              ))}
            </div>
          ))}
        </Section>
      )}

      {/* Skills */}
      {Object.keys(skills).length > 0 && (
        <Section title="Skills">
          {Object.entries(skills).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: px(3) }}>
              {Object.keys(skills).length > 1
                ? <><span style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{cat}: </span>
                    <span style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>{items.join(' • ')}</span></>
                : <span style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>{items.join(' • ')}</span>
              }
            </div>
          ))}
        </Section>
      )}

      {/* Certifications */}
      {resumeData.certifications?.length > 0 && (
        <Section title="Certifications">
          {resumeData.certifications.map((c, i) => (
            <div key={i} style={i < resumeData.certifications.length - 1 ? s.entry : {}}>
              <div style={{ fontFamily, fontSize: `${base}pt` }}>
                <strong>{c.name}</strong>{c.details ? ` | ${c.details}` : ''}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Volunteer */}
      {resumeData.volunteer?.length > 0 && (
        <Section title="Volunteer Experience">
          {resumeData.volunteer.map((v, i) => (
            <div key={i} style={i < resumeData.volunteer.length - 1 ? s.entry : {}}>
              <div style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{v.organization}</div>
              <div style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{v.description}</div>
            </div>
          ))}
        </Section>
      )}

      {/* Projects */}
      {resumeData.projects?.length > 0 && (
        <Section title="Projects">
          {resumeData.projects.map((p, i) => (
            <div key={i} style={i < resumeData.projects.length - 1 ? s.entry : {}}>
              <div style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{p.name}{p.link ? ` | ${p.link}` : ''}</div>
              <div style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{p.description}</div>
            </div>
          ))}
        </Section>
      )}

      {/* Additional Information */}
      {resumeData.additionalInfo?.length > 0 && (
        <Section title="Additional Information">
          {resumeData.additionalInfo.map((item, i) => (
            <div key={i} style={i < resumeData.additionalInfo.length - 1 ? { marginBottom: px(3) } : {}}>
              <div style={{ fontFamily, fontSize: `${base}pt`, lineHeight: '1.25', display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                <strong>{item.label}</strong>
                {item.detail && <span style={{ color: '#555' }}>| {item.detail}</span>}
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Languages */}
      {resumeData.languages?.length > 0 && (
        <Section title="Languages">
          <div style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>
            {resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' • ')}
          </div>
        </Section>
      )}
    </div>
  );
}