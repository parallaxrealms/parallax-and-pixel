export interface ChartSeries {
	key: string;
	label: string;
	color: string;
	points: { t: number; v: number | null }[];
	dashed?: boolean;
}
