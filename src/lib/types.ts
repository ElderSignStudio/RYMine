export type WishlistAlbum = {
	artist: string;
	title: string;
	year?: number;
	url: string;
	genres: string[];

	// future fields
	rating?: number;
	descriptors?: string[];

	dateAdded?: string;
	coverUrl?: string;

	// Album-detail enrichment fields, populated by the "Enrich Album" bookmarklet
	// when run on a RYM release page. All optional — albums without these still
	// render correctly.
	largeCoverUrl?: string;
	rymRating?: number;
	primaryGenres?: string[];
	secondaryGenres?: string[];
	myRating?: number;
	enrichedAt?: string;
};

export type GenreCount = {
	name: string;
	count: number;
};
