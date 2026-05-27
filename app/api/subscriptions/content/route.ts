import { NextRequest, NextResponse } from 'next/server';

const TMDB_BASE = 'https://api.themoviedb.org/3';

function getTmdbAuth(key: string): { paramStr: string; init: RequestInit } {
  if (key.startsWith('eyJ')) {
    return { paramStr: '', init: { headers: { Authorization: `Bearer ${key}` } } };
  }
  return { paramStr: `api_key=${key}`, init: {} };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tmdbProviderId = searchParams.get('tmdbProviderId');
  if (!tmdbProviderId) {
    return NextResponse.json({ error: 'tmdbProviderId required' }, { status: 400 });
  }

  const rawKey = process.env.TMDB_API_KEY;
  if (!rawKey || rawKey.trim() === '') {
    return NextResponse.json({ error: 'TMDB_API_KEY not configured' }, { status: 503 });
  }

  const { paramStr, init } = getTmdbAuth(rawKey);
  const base = paramStr ? `${paramStr}&` : '';
  const common = `watch_region=US&with_watch_providers=${tmdbProviderId}&sort_by=popularity.desc&include_adult=false`;

  const movieUrl = `${TMDB_BASE}/discover/movie?${base}${common}`;
  const tvUrl    = `${TMDB_BASE}/discover/tv?${base}${common}`;

  try {
    const [moviesRes, tvRes] = await Promise.all([fetch(movieUrl, init), fetch(tvUrl, init)]);
    const [moviesData, tvData] = await Promise.all([moviesRes.json(), tvRes.json()]);

    if (!moviesRes.ok || !tvRes.ok) {
      const msg = moviesData?.status_message ?? tvData?.status_message ?? 'TMDb API error';
      return NextResponse.json({ error: msg }, { status: moviesRes.status || tvRes.status });
    }

    // Interleave movies and shows so neither dominates
    const movies = (moviesData.results ?? []).map((i: Record<string, unknown>) => ({ ...i, media_type: 'movie' }));
    const shows  = (tvData.results   ?? []).map((i: Record<string, unknown>) => ({ ...i, media_type: 'tv' }));
    const combined: Record<string, unknown>[] = [];
    const maxLen = Math.max(movies.length, shows.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < movies.length) combined.push(movies[i]);
      if (i < shows.length)  combined.push(shows[i]);
    }

    return NextResponse.json({
      results: combined,
      totalMovies: moviesData.total_results ?? 0,
      totalShows:  tvData.total_results   ?? 0,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch from TMDb' }, { status: 500 });
  }
}
