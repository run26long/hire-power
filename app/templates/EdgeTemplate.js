// EdgeTemplate.js — Accent pill headers, skills near top | Pro tier
import { formatDate, formatDateRange, getSkillsDisplay } from './templateUtils';

export default function EdgeTemplate({ resumeData, font, fontSize, spacing = 1, accentColor, dateFormat = 'short' }) {
  if (!resumeData) return null;
  const skills = getSkillsDisplay(resumeData);
  const base = fontSize || 11;
  const sp = spacing || 1;
  const color = accentColor || '#5b4fcf';
  const fontFamily = font || 'Open Sans';
  const px = (n) => `${Math.round(n * sp)}px`;
  const professionalTitle = resumeData.professionalTitle || resumeData.experience?.[0]?.title || '';

  const s = {
    page: {
      fontFamily,
      fontSize: `${base}pt`,
      lineHeight: '1.2',
      color: '#1a1a1a',
      padding: `${px(36)} ${px(52)}`,
      background: '#fff',
      width: '100%',
      boxSizing: 'border-box',
    },
    hdr: {
      textAlign: 'center',
      marginBottom: px(14),
    },
    name: {
      fontFamily,
      fontSize: '22pt',
      fontWeight: '700',
      letterSpacing: '1px',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      marginBottom: px(2),
      lineHeight: '1.1',
      textAlign: 'center',
    },
    title: {
      fontFamily,
      fontSize: `${base}pt`,
      fontWeight: '700',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      textAlign: 'center',
      marginTop: px(4),
      marginBottom: px(4),
      lineHeight: '1.2',
    },
    contact: {
      fontFamily,
      fontSize: `${base - 0.5}pt`,
      color: '#555',
      textAlign: 'center',
      lineHeight: '1.3',
    },
    pill: {
      background: color + '33',
      borderRadius: '20px',
      padding: `${px(3)} ${px(10)}`,
      marginBottom: px(6),
      marginTop: px(12),
    },
    sh: {
      fontFamily,
      fontSize: `${base}pt`,
      fontWeight: '700',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      fontStyle: 'italic',
      color: '#1a1a1a',
      lineHeight: '1.2',
      textAlign: 'center',
    },
    section: { marginTop: '0' },
    sectionBody: { paddingLeft: px(10), paddingRight: px(10) },
    entry: { marginBottom: px(8) },
    jobLeft: {
      fontFamily,
      fontWeight: '700',
      fontSize: `${base}pt`,
      lineHeight: '1.2',
      color: '#1a1a1a',
    },
    dt: {
      fontFamily,
      fontSize: `${base}pt`,
      fontWeight: '700',
      color: '#1a1a1a',
      lineHeight: '1.2',
      flexShrink: 0,
      marginLeft: px(8),
    },
    co: {
      fontFamily,
      fontSize: `${base}pt`,
      color: '#555',
      marginBottom: px(2),
      lineHeight: '1.2',
    },
    li: {
      fontFamily,
      margin: `${px(1)} 0`,
      fontSize: `${base}pt`,
      display: 'flex',
      alignItems: 'flex-start',
      gap: '6px',
      lineHeight: '1.2',
    },
    sm: {
      fontFamily,
      fontSize: `${base}pt`,
      color: '#444',
      margin: `${px(2)} 0`,
      lineHeight: '1.2',
    },
    body: {
      fontFamily,
      fontSize: `${base}pt`,
      color: '#333',
      margin: `0 0 ${px(3)}`,
      lineHeight: '1.2',
    },
    skillsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: `${px(2)} ${px(8)}`,
    },
    skillItem: {
      fontFamily,
      fontSize: `${base}pt`,
      color: '#333',
      lineHeight: '1.4',
    },
  };

  const contactParts = [
    resumeData.phone,
    resumeData.email,
    resumeData.location,
    resumeData.linkedin,
    resumeData.portfolio,
  ].filter(Boolean);

  const SH = ({ title }) => (
    <div style={s.pill}>
      <div style={s.sh}>{title}</div>
    </div>
  );

  const allSkillValues = Object.values(skills).flat();

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.hdr}>
        <div style={s.name}>{resumeData.fullName}</div>
        {professionalTitle && <div style={s.title}>{professionalTitle}</div>}
        <div style={s.contact}>{contactParts.join(' | ')}</div>
      </div>

      {/* Summary */}
      {resumeData.summary && !resumeData.hideSummary && (
        <div style={s.section}>
          <SH title={resumeData.sectionTitles?.summary || 'Summary'} />
          <div style={s.sectionBody}>
            <p style={s.body}>{resumeData.summary}</p>
          </div>
        </div>
      )}

      {/* Skills — near top, 3-column grid if single category */}
      {allSkillValues.length > 0 && (
        <div style={s.section}>
          <SH title="Skills" />
          <div style={s.sectionBody}>
            {Object.entries(skills).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: px(4) }}>
                {Object.keys(skills).length > 1 && (
                  <span style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{cat}: </span>
                )}
                <span style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>{items.join(' • ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experience */}
      {resumeData.experience?.length > 0 && (
        <div style={s.section}>
          <SH title={resumeData.sectionTitles?.experience || 'Professional Experience'} />
          <div style={s.sectionBody}>
            {resumeData.experience.map((job, i) => (
              <div key={i} style={i < resumeData.experience.length - 1 ? s.entry : {}}>
                <div style={s.jobLeft}>{job.title}</div>
                <div style={s.co}>
                  {[job.company, job.location, formatDateRange(job.startDate, job.endDate, job.current, dateFormat)]
                    .filter(Boolean).join(' | ')}
                </div>
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
          </div>
        </div>
      )}

      {/* Education */}
      {resumeData.education?.length > 0 && (
        <div style={s.section}>
          <SH title="Education" />
          <div style={s.sectionBody}>
            {resumeData.education.map((ed, i) => (
              <div key={i} style={i < resumeData.education.length - 1 ? s.entry : {}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: px(1) }}>
                  <span style={s.jobLeft}>{[ed.degree, ed.field].filter(Boolean).join(', ') || ed.school}</span>
                  <span style={s.dt}>{formatDate(ed.graduationDate, dateFormat)}</span>
                </div>
                <div style={s.co}>{ed.school}</div>
                {ed.lines?.map((l, k) => (
                  <div key={k} style={{ fontFamily, fontSize: `${base}pt`, color: '#333', lineHeight: '1.2' }}>{l}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
      {resumeData.certifications?.length > 0 && (
        <div style={s.section}>
          <SH title="Certifications" />
          <div style={s.sectionBody}>
            {resumeData.certifications.map((c, i) => (
              <div key={i} style={i < resumeData.certifications.length - 1 ? s.entry : {}}>
                <div style={{ fontFamily, fontSize: `${base}pt` }}>
                  <strong>{c.name}</strong>{c.details ? ` | ${c.details}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Volunteer */}
      {resumeData.volunteer?.length > 0 && (
        <div style={s.section}>
          <SH title="Volunteer Experience" />
          <div style={s.sectionBody}>
            {resumeData.volunteer.map((v, i) => (
              <div key={i} style={i < resumeData.volunteer.length - 1 ? s.entry : {}}>
                <div style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{v.organization}</div>
                <div style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{v.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {resumeData.projects?.length > 0 && (
        <div style={s.section}>
          <SH title="Projects" />
          <div style={s.sectionBody}>
            {resumeData.projects.map((p, i) => (
              <div key={i} style={i < resumeData.projects.length - 1 ? s.entry : {}}>
                <div style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{p.name}{p.link ? ` | ${p.link}` : ''}</div>
                <div style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{p.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional Information */}
      {resumeData.additionalInfo?.length > 0 && (
        <div style={s.section}>
          <SH title="Additional Information" />
          <div style={s.sectionBody}>
            {resumeData.additionalInfo.map((item, i) => (
              <div key={i} style={s.li}>
                <span style={{ flexShrink: 0 }}>•</span>
                <span style={{ fontFamily, fontSize: `${base}pt`, lineHeight: '1.2' }}>
                  <strong>{item.label}</strong>
                  {item.detail && <span style={{ color: '#555' }}> | {item.detail}</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Languages */}
      {resumeData.languages?.length > 0 && (
        <div style={s.section}>
          <SH title="Languages" />
          <div style={s.sectionBody}>
            <div style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>
              {resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' • ')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}