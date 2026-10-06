import { ago, compact, num } from '@/lib/format';
import type { VideoDetail } from '@/lib/types';
import { MetricCard } from './MetricCard';

export function MetricsRow({ video }: { video: VideoDetail['video'] }) {
  const kind = video.isShort ? 'short videos' : 'longer videos';
  const baseline = video.outlierMultiple === null
    ? video.monitored ? `The channel's normal for ${kind} is not available yet.` : 'Needs five videos from this account.'
    : `The channel's normal: ${compact(video.channelMedianViews ?? 0)} views for ${kind}.`;
  return (
    <section aria-label="Current numbers">
      <dl className="metrics-row">
        <MetricCard hero label="Outlier score" value={video.outlierMultiple === null ? 'No baseline' : `${video.outlierMultiple}x`} pending={video.outlierMultiple === null} detail={baseline} />
        <MetricCard label="Views" value={video.viewCount === null ? 'Hidden' : num(video.viewCount)} pending={video.viewCount === null} detail={`Checked ${ago(video.lastCheckedAt)}`} />
        <MetricCard label="Views per hour" value={video.viewsPerHour === null ? 'Not yet' : `${video.viewsPerHour >= 0 ? '+' : ''}${num(Math.round(video.viewsPerHour))}`} pending={video.viewsPerHour === null} detail={video.viewsPerHour === null ? 'Awaiting next check' : 'Between the last two checks'} hint={video.viewsPerHour === null ? (video.monitored ? 'Momentum needs two checks. Views gained per hour will appear after the next scheduled check.' : 'Momentum needs two checks. Use Update numbers later to measure the views gained per hour.') : 'Views gained divided by the hours between the last two checks.'} />
        <MetricCard label="Likes" value={video.likeCount === null ? 'Hidden' : compact(video.likeCount)} pending={video.likeCount === null} />
        <MetricCard label="Comments" value={video.commentCount === null ? 'Off' : compact(video.commentCount)} pending={video.commentCount === null} />
      </dl>
    </section>
  );
}
