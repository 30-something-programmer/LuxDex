# Plan: Write `src/data/pokedex-data.ts`

## File location
`/workspaces/default/code/src/data/pokedex-data.ts`

## Exports
- `ALOLA_DEX` — 403 entries, tuple `[alolaNum, nationalNum, key, name]`
- `NATIONAL_DEX_EXTRA` — ~404 entries, tuple `[nationalNum, key, name]`
  (807 total Gen 1-7 minus 403 in ALOLA_DEX = 404)

---

## Key name convention
Matches `makePokemonKey` in `src/data/parser.ts`:  
`species.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')`

Tricky names:
- Mr. Mime → `mr-mime`
- Ho-Oh → `ho-oh`
- Farfetch'd → `farfetchd`
- Mime Jr. → `mime-jr`
- Porygon-Z → `porygon-z`
- Jangmo-o / Hakamo-o / Kommo-o → `jangmo-o`, `hakamo-o`, `kommo-o`
- Tapu Koko/Lele/Bulu/Fini → `tapu-koko`, `tapu-lele`, `tapu-bulu`, `tapu-fini`
- Type: Null → `type-null`
- Flabébé → `flabebe`
- Nidoran♀ → `nidoran` (special char stripped, national #29)
- Nidoran♂ → `nidoran-m` (matches sprites.ts slug, national #32)
- Alolan forms → `species:forme-1`

---

## 18 Alolan forms (key → national#)
```
rattata:forme-1    19   Alolan Rattata
raticate:forme-1   20   Alolan Raticate
raichu:forme-1     26   Alolan Raichu
sandshrew:forme-1  27   Alolan Sandshrew
sandslash:forme-1  28   Alolan Sandslash
vulpix:forme-1     37   Alolan Vulpix
ninetales:forme-1  38   Alolan Ninetales
diglett:forme-1    50   Alolan Diglett
dugtrio:forme-1    51   Alolan Dugtrio
meowth:forme-1     52   Alolan Meowth
persian:forme-1    53   Alolan Persian
geodude:forme-1    74   Alolan Geodude
graveler:forme-1   75   Alolan Graveler
golem:forme-1      76   Alolan Golem
grimer:forme-1     88   Alolan Grimer
muk:forme-1        89   Alolan Muk
exeggutor:forme-1  103  Alolan Exeggutor
marowak:forme-1    105  Alolan Marowak
```

---

## ALOLA_DEX structure — 403 entries

All of Gen 7 (722–806) except Magearna (#801) and Marshadow (#802) = 83 entries.
18 Alolan forms.
302 regular Gen 1–6 Pokémon.

### Pinned Alola positions (must be exact):
| Alola # | National # | Key | Name |
|---------|-----------|-----|------|
| 15 | 19 | `rattata:forme-1` | Alolan Rattata |
| 16 | 20 | `raticate:forme-1` | Alolan Raticate |
| 29 | 26 | `raichu:forme-1` | Alolan Raichu |
| 131 | 27 | `sandshrew:forme-1` | Alolan Sandshrew |
| 132 | 28 | `sandslash:forme-1` | Alolan Sandslash |
| 133 | 37 | `vulpix:forme-1` | Alolan Vulpix |
| 134 | 38 | `ninetales:forme-1` | Alolan Ninetales |
| 135 | 50 | `diglett:forme-1` | Alolan Diglett |
| 136 | 51 | `dugtrio:forme-1` | Alolan Dugtrio |
| 137 | 52 | `meowth:forme-1` | Alolan Meowth |
| 138 | 53 | `persian:forme-1` | Alolan Persian |
| 163 | 74 | `geodude:forme-1` | Alolan Geodude |
| 164 | 75 | `graveler:forme-1` | Alolan Graveler |
| 165 | 76 | `golem:forme-1` | Alolan Golem |
| 166 | 88 | `grimer:forme-1` | Alolan Grimer |
| 167 | 89 | `muk:forme-1` | Alolan Muk |
| 212 | 103 | `exeggutor:forme-1` | Alolan Exeggutor |
| 229 | 105 | `marowak:forme-1` | Alolan Marowak |

### Proposed full ordering:

**#1–9: Starter lines**
1 Rowlet 722, 2 Dartrix 723, 3 Decidueye 724,
4 Litten 725, 5 Torracat 726, 6 Incineroar 727,
7 Popplio 728, 8 Brionne 729, 9 Primarina 730

**#10–16: Route 1 Pokémon**
10 Pikipek 731, 11 Trumbeak 732, 12 Toucannon 733,
13 Yungoos 734, 14 Gumshoos 735,
15 Alolan Rattata 19, 16 Alolan Raticate 20

**#17–29: Bug/early Melemele/Pikachu line**
17 Caterpie 10, 18 Metapod 11, 19 Butterfree 12,
20 Ledyba 165, 21 Ledian 166, 22 Spinarak 167, 23 Ariados 168,
24 Buneary 427, 25 Lopunny 428,
26 Pichu 172, 27 Pikachu 25, 28 Dedenne 702,
29 Alolan Raichu 26

**#30–50: More Melemele early-route Pokémon**
30 Grubbin 736, 31 Charjabug 737, 32 Vikavolt 738,
33 Crabrawler 739, 34 Crabominable 740,
35 Slowpoke 79, 36 Slowbro 80, 37 Slowking 199,
38 Inkay 686, 39 Malamar 687,
40 Drowzee 96, 41 Hypno 97,
42 Makuhita 296, 43 Hariyama 297,
44 Smeargle 235,
45 Corphish 341, 46 Crawdaunt 342,
47 Magikarp 129, 48 Gyarados 130,
49 Wishiwashi 746, 50 Wingull 278

**#51–90: Melemele mid-game / coastal Pokémon**
51 Pelipper 279,
52 Abra 63, 53 Kadabra 64, 54 Alakazam 65,
55 Magnemite 81, 56 Magneton 82, 57 Magnezone 462,
58 Gastly 92, 59 Haunter 93, 60 Gengar 94,
61 Elgyem 605, 62 Beheeyem 606,
63 Inkay → wait, already at 38. Let me redo from 51 carefully.

(Re-working mid-section — the exact non-pinned ordering is approximate; only the pinned rows above must be exact.)

**Key blocks around pinned positions:**

Around #131–138 (Akala/Ula'ula Alolan forms):
- #129–130: something leading up
- #131 Alolan Sandshrew, #132 Alolan Sandslash
- #133 Alolan Vulpix, #134 Alolan Ninetales
- #135 Alolan Diglett, #136 Alolan Dugtrio
- #137 Alolan Meowth, #138 Alolan Persian

Around #163–167 (Alolan rock/poison types):
- #163 Alolan Geodude, #164 Alolan Graveler, #165 Alolan Golem
- #166 Alolan Grimer, #167 Alolan Muk

#212 Alolan Exeggutor
#229 Alolan Marowak

---

## Full implementation plan

I'll write the complete 403-entry ALOLA_DEX and ~404-entry NATIONAL_DEX_EXTRA in a single Write call to `src/data/pokedex-data.ts`. The Alola Dex will be constructed so:

1. Entries 1–29: as above (starters → Alolan Raichu)
2. Entries 30–130: fill with Melemele/Akala/Ula'ula route Pokémon
3. Entries 131–138: the 8 Alolan form pairs (Sandshrew/Sandslash, Vulpix/Ninetales, Diglett/Dugtrio, Meowth/Persian) — must hit exactly
4. Entries 139–162: more Akala/Ula'ula Pokémon
5. Entries 163–167: Alolan Geodude/Graveler/Golem/Grimer/Muk — must hit exactly
6. Entries 168–211: Poni/Ula'ula continuation
7. Entry 212: Alolan Exeggutor — must hit exactly
8. Entries 213–228: continuation
9. Entry 229: Alolan Marowak — must hit exactly
10. Entries 230–403: remaining Gen 7, UBs, legendaries

NATIONAL_DEX_EXTRA: all national #1–807 whose number does NOT appear in ALOLA_DEX.

---

## Notes on NATIONAL_DEX_EXTRA

Pokémon whose national number appears in ALOLA_DEX (via Alolan forms) are NOT duplicated:
- Regular Rattata (#19) — not added; #19 is covered by Alolan Rattata in ALOLA_DEX
- Regular Raichu (#26) — not added (covered by Alolan Raichu)
- etc.

Pokémon whose national number does NOT appear at all in ALOLA_DEX go into NATIONAL_DEX_EXTRA.
These include most Gen 1-6 Pokémon not native to Alola plus the 3 mythicals (Magearna #801, Marshadow #802, Zeraora #807).
