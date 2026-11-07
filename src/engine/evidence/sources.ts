/**
 * Evidence sources. `verified: false` = bibliographic details still need to be checked
 * against the original paper before being shown to users as a citation.
 */
export interface EvidenceSource {
  id: string;
  citation: string;
  year: number;
  studyType: 'position_stand' | 'meta_analysis' | 'systematic_review' | 'expert_consensus' | 'rct' | 'practice';
  verified: boolean;
}

export const SOURCES: EvidenceSource[] = [
  { id: 'acsm2026', citation: 'ACSM Position Stand on resistance training (2026)', year: 2026, studyType: 'position_stand', verified: false },
  { id: 'currier2023', citation: 'Currier et al. Resistance training prescription for muscle strength and hypertrophy: systematic review and Bayesian network meta-analysis. Br J Sports Med', year: 2023, studyType: 'meta_analysis', verified: false },
  { id: 'lopez2021', citation: 'Lopez et al. Resistance training load effects on muscle hypertrophy and strength gain: systematic review and network meta-analysis. Med Sci Sports Exerc', year: 2021, studyType: 'meta_analysis', verified: false },
  { id: 'schoenfeld2017vol', citation: 'Schoenfeld et al. Dose-response relationship between weekly resistance training volume and increases in muscle mass. J Sports Sci', year: 2017, studyType: 'meta_analysis', verified: false },
  { id: 'pelland_volume', citation: 'Pelland et al. Meta-regressions of weekly volume and frequency on hypertrophy and strength', year: 2025, studyType: 'meta_analysis', verified: false },
  { id: 'schoenfeld2016freq', citation: 'Schoenfeld et al. Effects of resistance training frequency on measures of muscle hypertrophy. Sports Med', year: 2016, studyType: 'meta_analysis', verified: false },
  { id: 'grgic2018rest', citation: 'Grgic et al. Effects of rest interval duration in resistance training on measures of muscular strength: systematic review. Sports Med', year: 2018, studyType: 'systematic_review', verified: false },
  { id: 'singer2024rest', citation: 'Singer et al. Give it a rest: inter-set rest interval durations and muscle hypertrophy, Bayesian meta-analysis. Front Sports Act Living', year: 2024, studyType: 'meta_analysis', verified: false },
  { id: 'refalo_failure', citation: 'Refalo et al. Proximity-to-failure and muscle hypertrophy / strength: systematic review and meta-analysis', year: 2023, studyType: 'meta_analysis', verified: false },
  { id: 'helms2016rir', citation: 'Helms et al. Application of the repetitions in reserve-based RPE scale for resistance training. Strength Cond J', year: 2016, studyType: 'practice', verified: false },
  { id: 'zourdos2016rir', citation: 'Zourdos et al. Novel resistance training-specific RPE scale measuring repetitions in reserve. J Strength Cond Res', year: 2016, studyType: 'rct', verified: false },
  { id: 'spiering2021', citation: 'Spiering et al. Maintaining physical performance: the minimal dose of exercise needed. J Strength Cond Res', year: 2021, studyType: 'systematic_review', verified: false },
  { id: 'bell2023deload', citation: 'Bell et al. Integrating deloading into strength and physique sports training programmes: Delphi consensus. Sports Med Open', year: 2023, studyType: 'expert_consensus', verified: false },
  { id: 'acsm2009', citation: 'ACSM Position Stand: Progression models in resistance training for healthy adults. Med Sci Sports Exerc', year: 2009, studyType: 'position_stand', verified: false },
  { id: 'practice', citation: '코칭 실무 기반 기본값 (사용 기록으로 보정 예정)', year: 2026, studyType: 'practice', verified: true },
];
