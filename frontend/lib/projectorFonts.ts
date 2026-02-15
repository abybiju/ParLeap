import {
  Inter,
  DM_Sans,
  Manrope,
  Playfair_Display,
  Space_Grotesk,
  Cormorant_Garamond,
  Bebas_Neue,
  Caveat,
  Open_Sans,
  Lato,
  Roboto,
  Oswald,
  Montserrat,
  Raleway,
  Poppins,
  Merriweather,
} from 'next/font/google';

const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] });
const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '700'] });
const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '700'] });
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '600', '700'] });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '700'] });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });
const bebas = Bebas_Neue({ subsets: ['latin'], weight: ['400'] });
const caveat = Caveat({ subsets: ['latin'], weight: ['400', '600', '700'] });
const openSans = Open_Sans({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] });
const lato = Lato({ subsets: ['latin'], weight: ['300', '400', '700'] });
const roboto = Roboto({ subsets: ['latin'], weight: ['300', '400', '500', '700'] });
const oswald = Oswald({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });
const montserrat = Montserrat({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] });
const raleway = Raleway({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] });
const poppins = Poppins({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] });
const merriweather = Merriweather({ subsets: ['latin'], weight: ['300', '400', '700'] });

export const projectorFonts = [
  { id: 'inter', label: 'Inter', className: inter.className },
  { id: 'dm-sans', label: 'DM Sans', className: dmSans.className },
  { id: 'manrope', label: 'Manrope', className: manrope.className },
  { id: 'space-grotesk', label: 'Space Grotesk', className: spaceGrotesk.className },
  { id: 'playfair', label: 'Playfair Display', className: playfair.className },
  { id: 'cormorant', label: 'Cormorant Garamond', className: cormorant.className },
  { id: 'bebas', label: 'Bebas Neue', className: bebas.className },
  { id: 'caveat', label: 'Caveat', className: caveat.className },
  { id: 'open-sans', label: 'Open Sans', className: openSans.className },
  { id: 'lato', label: 'Lato', className: lato.className },
  { id: 'roboto', label: 'Roboto', className: roboto.className },
  { id: 'oswald', label: 'Oswald', className: oswald.className },
  { id: 'montserrat', label: 'Montserrat', className: montserrat.className },
  { id: 'raleway', label: 'Raleway', className: raleway.className },
  { id: 'poppins', label: 'Poppins', className: poppins.className },
  { id: 'merriweather', label: 'Merriweather', className: merriweather.className },
];

export type ProjectorFontId = (typeof projectorFonts)[number]['id'];

export function getProjectorFontClass(fontId?: string | null): string {
  const match = projectorFonts.find((font) => font.id === fontId);
  return match?.className ?? projectorFonts[0].className;
}

export function getProjectorFontIdOrDefault(fontId?: string | null): ProjectorFontId {
  const match = projectorFonts.find((font) => font.id === fontId);
  return (match?.id ?? projectorFonts[0].id) as ProjectorFontId;
}
