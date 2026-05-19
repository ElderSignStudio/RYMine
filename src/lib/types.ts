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
};

export type GenreCount = {
	name: string;
	count: number;
};
