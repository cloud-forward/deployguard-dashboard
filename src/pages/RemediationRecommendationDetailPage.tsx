import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useGetRemediationRecommendationDetailApiV1ClustersClusterIdRemediationRecommendationsRecommendationIdGet } from '../api/generated/clusters/clusters';
import type {
  RemediationRecommendationDetailEnvelopeResponse,
  RemediationRecommendationDetailResponse,
} from '../api/model';

const formatNumber = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }

  return value.toLocaleString();
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return '-';
  }

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return timestamp.toLocaleString('ko-KR');
};

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
};

const renderValue = (value: unknown): string => {
  if (value == null) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const isRemediationRecommendationEnvelope = (
  value: unknown,
): value is RemediationRecommendationDetailEnvelopeResponse =>
  Boolean(value && typeof value === 'object' && 'cluster_id' in value);

const SummaryField: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="col-12 col-md-6 col-xl-3">
    <div className="border rounded-3 p-3 h-100 bg-white">
      <div className="text-muted small mb-1">{label}</div>
      <div className="fw-semibold text-break">{value}</div>
    </div>
  </div>
);

const DetailSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="card border-0 shadow-sm">
    <div className="card-body">
      <h2 className="h6 mb-3">{title}</h2>
      {children}
    </div>
  </div>
);

const MetadataSection: React.FC<{
  metadata?: Record<string, unknown>;
}> = ({ metadata }) => {
  const entries = Object.entries(metadata ?? {});

  if (entries.length === 0) {
    return null;
  }

  return (
    <DetailSection title="Metadata / Generated Fields">
      <div className="row g-3">
        {entries.map(([key, value]) => (
          <div className="col-12 col-lg-6" key={key}>
            <div className="border rounded-3 p-3 h-100 bg-light">
              <div className="text-muted small mb-1">{key}</div>
              <pre className="mb-0 small text-wrap" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {renderValue(value)}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </DetailSection>
  );
};

const ListSection: React.FC<{
  title: string;
  items: Array<string | number>;
  emptyLabel: string;
}> = ({ title, items, emptyLabel }) => (
  <DetailSection title={title}>
    {items.length === 0 ? (
      <div className="text-muted small">{emptyLabel}</div>
    ) : (
      <ol className="mb-0 ps-3">
        {items.map((item) => (
          <li key={String(item)} className="mb-2 text-break">
            {String(item)}
          </li>
        ))}
      </ol>
    )}
  </DetailSection>
);

const RecommendationNarrative: React.FC<{
  recommendation: RemediationRecommendationDetailResponse;
}> = ({ recommendation }) => (
  <DetailSection title="Recommendation Summary">
    <div className="d-flex flex-column gap-3">
      <div>
        <div className="text-muted small mb-1">Fix Description</div>
        <div className="text-break">{recommendation.fix_description ?? '-'}</div>
      </div>
      <div className="row g-3">
        <div className="col-12 col-lg-4">
            <div className="border rounded-3 p-3 h-100 bg-light">
              <div className="text-muted small mb-1">Target Edge</div>
              <div className="fw-semibold text-break">
                {recommendation.edge_source ?? '-'} {'->'} {recommendation.edge_target ?? '-'}
              </div>
            </div>
          </div>
        <div className="col-12 col-lg-4">
          <div className="border rounded-3 p-3 h-100 bg-light">
            <div className="text-muted small mb-1">Edge Type</div>
            <div className="fw-semibold text-break">{recommendation.edge_type ?? '-'}</div>
          </div>
        </div>
        <div className="col-12 col-lg-4">
          <div className="border rounded-3 p-3 h-100 bg-light">
            <div className="text-muted small mb-1">Fix Type</div>
            <div className="fw-semibold text-break">{recommendation.fix_type ?? '-'}</div>
          </div>
        </div>
      </div>
    </div>
  </DetailSection>
);

const RemediationRecommendationDetailPage: React.FC = () => {
  const { clusterId = '', recommendationId = '' } = useParams();
  const query = useGetRemediationRecommendationDetailApiV1ClustersClusterIdRemediationRecommendationsRecommendationIdGet(
    clusterId,
    recommendationId,
    {
      query: {
        enabled: Boolean(clusterId && recommendationId),
        retry: false,
      },
    },
  );

  const envelope = isRemediationRecommendationEnvelope(query.data) ? query.data : null;
  const recommendation = envelope?.recommendation ?? null;
  const blockedPathIds = Array.isArray(recommendation?.blocked_path_ids) ? recommendation.blocked_path_ids : [];
  const blockedPathIndices = Array.isArray(recommendation?.blocked_path_indices)
    ? recommendation.blocked_path_indices
    : [];

  if (query.isLoading) {
    return (
      <div className="container-fluid py-4">
        <div className="card border-0 shadow-sm">
          <div className="card-body py-5 text-center text-muted">Remediation recommendation detail loading…</div>
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="container-fluid py-4">
        <div className="card border-0 shadow-sm">
          <div className="card-body py-4">
            <div className="alert alert-danger mb-3" role="alert">
              {toErrorMessage(query.error, 'Remediation recommendation detail could not be loaded.')}
            </div>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => query.refetch()}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!envelope || !recommendation) {
    return (
      <div className="container-fluid py-4">
        <div className="card border-0 shadow-sm">
          <div className="card-body py-5 text-center">
            <h1 className="h4 mb-2">No remediation recommendation detail found.</h1>
            <p className="text-muted mb-3">The backend returned no detail payload for this recommendation.</p>
            {clusterId ? (
              <Link to={`/clusters/${clusterId}/graph`} className="btn btn-outline-secondary btn-sm">
                Back to Attack Graph
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <div className="text-muted small text-uppercase mb-2">Remediation Recommendation Detail</div>
          <h1 className="h3 mb-2 text-break">{recommendation.fix_description || recommendation.recommendation_id}</h1>
          <div className="text-muted small text-break">
            Cluster <strong>{envelope.cluster_id}</strong> / Recommendation <strong>{recommendation.recommendation_id}</strong>
          </div>
        </div>
        {clusterId ? (
          <Link to={`/clusters/${clusterId}/graph`} className="btn btn-outline-secondary btn-sm">
            Back to Attack Graph
          </Link>
        ) : null}
      </div>

      <div className="row g-3 mb-4">
        <SummaryField label="Cluster ID" value={envelope.cluster_id} />
        <SummaryField label="Recommendation ID" value={recommendation.recommendation_id} />
        <SummaryField label="Rank" value={recommendation.recommendation_rank + 1} />
        <SummaryField label="Fix Type" value={recommendation.fix_type ?? '-'} />
        <SummaryField label="Fix Cost" value={formatNumber(recommendation.fix_cost)} />
        <SummaryField label="Edge Score" value={formatNumber(recommendation.edge_score)} />
        <SummaryField label="Covered Risk" value={formatNumber(recommendation.covered_risk)} />
        <SummaryField
          label="Cumulative Risk Reduction"
          value={formatNumber(recommendation.cumulative_risk_reduction)}
        />
        <SummaryField label="Analysis Run ID" value={envelope.analysis_run_id ?? '-'} />
        <SummaryField label="Generated At" value={formatDateTime(envelope.generated_at)} />
      </div>

      <div className="d-flex flex-column gap-4">
        <RecommendationNarrative recommendation={recommendation} />
        <div className="row g-4">
          <div className="col-12 col-xl-6">
            <ListSection
              title="Blocked Path IDs"
              items={blockedPathIds}
              emptyLabel="No blocked path ids were returned."
            />
          </div>
          <div className="col-12 col-xl-6">
            <ListSection
              title="Blocked Path Indices"
              items={blockedPathIndices}
              emptyLabel="No blocked path indices were returned."
            />
          </div>
        </div>
        <MetadataSection metadata={recommendation.metadata} />
      </div>
    </div>
  );
};

export default RemediationRecommendationDetailPage;
