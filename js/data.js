/* =====================================================================
   LOUTRIS ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â js/data.js
   Static game data: word lists, ranks, achievements, shop catalog,
   season pass track, quest templates, events, cosmetics, bot personas.
   ===================================================================== */
(function (global) {
  "use strict";

  // ---------- Word lists (answers + valid guesses) ----------
  // 5-letter answer pool (curated common words)
  var W5 = ("abide ability abode about above abuse acidy acorn acute adage adapt adept " +
    "admit adobe adopt adore adult affine agent aglow ahead aider aisle alarm " +
    "album alert algae alien align alike alive alley allow alloy aloft alone " +
    "along aloof aloud alpha altar alter amaze amber amble amend amiss among " +
    "ample amply amuse anger angle angry ankle annex annoy annul anode " +
    "antic anvil aorta apart aphid apnea apple apply apron arena argue arise " +
    "armor aroma arose array arrow arson ashen aside askew asset assay astir " +
    "atlas atoll atom attic audio audit augur aunts aura auto avail avert " +
    "avian avid avoid await awake award aware awash awful awoke axles azure " +
    "bacon badge bagel baker bales balky balls balmy banal bands bands banjo " +
    "barge baron basal basic basin basis batch bathe baton batty bawdy bayou " +
    "beach beads beard beast bezel begat beget begin begun being belch belie " +
    "belle belly below belts bench bends berry berth beset bevel bezel bible " +
    "bicker bides bigot biked biker bikes biles bilge billy binge bingo biome " +
    "birch birds birth bison bites bitsy blabs black blade blame bland blank " +
    "blare blast blaze bleak bleat bleed blend bless blimp blind blink bliss " +
    "blimp blitz bloat block bloke blond blood bloom blot blowy bluff blunt " +
    "blurb blurt board boast bobby bodes bogey boggy boils bolts bonds boned " +
    "bones boney bongo bonus booed books booms boost booth boots booze " +
    "borax bored bores boric borne bosom bossy botch bough bound bouts bowls " +
    "boxed boxer braces braid brain brake brand brash brass brats brave brawl " +
    "bread break breed brews briar bribe brick bride brief brine bring brink " +
    "briny brisk broad broil broke brood brook broom broth brown brunt brush " +
    "brute bucks buddy budge buenos buffy buggy bugle build built bulbs bulge " +
    "bulky bulls bully bumps bumpy bunch bunks bunny burly burns burnt burps " +
    "burst bused bushy butch butte butts buyer bylaw cabal cabby cabin cable " +
    "cacao cache caddy cadet cadre caked cakes caked calls calms camel cameo " +
    "campy canal candy caned canes canoe canon caper capon caput carat cards " +
    "cared cares cargo carol carry carts carve casks caste catch cater catty " +
    "cause caved caver caves cease cello cents chafe chaff chain chair chalk " +
    "champ chant chaos chaps chard charm charts chase chasm cheap cheat check " +
    "cheek cheer chess chest chew chide chief child chili chill chime chimp " +
    "chins chirp chock choir choke chomp chops chord chore chose chow chuck " +
    "chums chunk chute cider cigar cinch circa cited cites civic civil claim " +
    "clams clamp clang clank clans claps clash clasp class clave clean clear " +
    "cleat cleft clerk click cliff climb cling clink clips cloak clock clods " +
    "clogs clone close cloth clots cloud clout clove clown clubs clued clues " +
    "clump clung coach coast coats cobra cocoa codas coded codes " +
    "coils coins colon color combo comer comes comet comfy comic comma conch " +
    "condo cones conic copra copse coral cords cored cores corks corny corps " +
    "couch cough could count coups court coven cover covet covey cowed cower " +
    "coyly crabs crack craft crags cramp crane crank crash crass crate crave " +
    "craws craze crazy creak cream crepe crept cress crest crews cribs cried " +
    "crier crimes crimp crisp croak crock crone crook croon crops cross crowd " +
    "crown crude cruel crumb crunk crush crust crypt cubed cubes cubic cubit " +
    "cuffs cuing culls cults cupid cupped curbs curds cured cures curio curls " +
    "curly curry curse curve curvy cuter cutie cycle cynic dabba daddy dairy " +
    "daisy dance dandy dared dares darts dated dates datum daunt dazed dealt " +
    "death debit debut debug decay decoy decry deeds defer deign deity delay " +
    "delta delve denim dense depth derby desks deter devil diary " +
    "dicey dices digit dimes dimly dined diner dines dingo dingy dinky dirty " +
    "discs disco ditch ditto ditty divan diver dives divot dizzy dodge dodgy " +
    "doers doffs dogma doily doing dolly domes donor dooms doors doped dopes " +
    "dopey dosed doses doter dotes doubt dough doused doves dowel downs dowry " +
    "dozed dozen drabs draft drags drain drake drama drank drape drawn draws " +
    "dread dream dress dried drier drift drill drink drips drive drone drool " +
    "droop drops dross drove drown drugs drums drunk dryer dryly ducal duchy " +
    "ducks duels duets dukes dummy dumps dumpy dunce dunes dupes durum dusky " +
    "dusts dusty dutch duvet dwarf dwell dwelt dying eager eagle early earns " +
    "earth easel eaten eater eaves ebbed ebony edged edges edict edify eerie " +
    "egged egret eider eight eject elate elbow elder elect elegy elfin elide " +
    "elite elope elude elves embed ember emcee emery emirs emits empty emote " +
    "enemy ensue enter entry envoy epoch equal equip erase erect erode error " +
    "erupt essay ester ether ethic evade evens event every evict evil exalt " +
    "excel exert exile exist expel extol extra exult fable faced faces facet " +
    "facto faded fades fails faint fairy faith faked fakes faker falls false " +
    "famed fancy fangs farce fared fares farms fatal fated fates fatty fault " +
    "fauna favor fawns faxed faxes feast feats fecal feeds feels feign felon " +
    "femur fence feral ferns ferry fetal fetch fetid fever fewer fiber fibs " +
    "ficus fiend fiery fifes fifth fifty fight filed files filet fills filly " +
    "films filmy final finch finds fined finer fines finis fiord fired fires " +
    "firer firms first firth fishy fists fitly fives fixed fixer fizzy fjord " +
    "flabs flack flags flair flake flaky flame flank flaps flare flash flask " +
    "flats flaws fleck fleet flesh flick flies fling flint flips flirt flits " +
    "float flock flood floor flora floss flour flout flown flows flubs fluey " +
    "fluff fluid fluke flume flung flunk flush flute flyby foals foamy focal " +
    "focus foggy folds folio folks folly fonts foods fools foray force forge " +
    "forgo forks forms forte forth forts forum found fount fours fowls foyer " +
    "frail frame frank fraud freak freed freer fresh fried frill fries frigs " +
    "frill fritz frizz frock frogs frond front frost froth frown froze fruit " +
    "fryer fudge fudgy fugue fully fumed fumes fungi funky funny furor furry " +
    "fused fuses fussy fuzzy gable gaily gains gaits galas gales galls gamed " +
    "games gamut gaped gapes gappy garbs gases gasps gated gates gator gauge " +
    "gaunt gauze gavel gawks gawky gazed gazes gears gecko geeks geese genes " +
    "genie genre gents germs getup ghost ghoul giant gibes giddy gifts gilts " +
    "gimp girdle girls girth given gives glade glads gland glans glare glass " +
    "glaze gleam glean glens glide glint gloat globe gloom glory gloss glove " +
    "glows glued glues glume glyph gnarl gnash gnats gnaws goads goals goats " +
    "godly going golds golem golfs gonad goods goody gooey goofs goofy goons " +
    "goopy goose gored gores gorge gospel gouge gourd gowns grace grade graft " +
    "grail grain grams grand grant grape graph grasp grass grate grave gravy " +
    "graze great greed green greet greys grids grief grill grime grimy grind " +
    "grins grips gripe grist grits groats grogs groin groom grope gross group " +
    "grout grove grown grows gruel gruff grump grunt guard guava guess guest " +
    "guide guild guile guilt guise gulch gulfs gulls gully gulps gumbo gummy " +
    "gunky guppy gusto gusts gusty gypsy habit hacks hadji hairs hairy haled " +
    "hales halls halve hands handy hangs happy hardy hares harps harsh haste " +
    "hasty hatch hated hater hates haunt haven havoc hawks hayed hazed hazes " +
    "heads heady heals heaps heard hears heart heath heave heavy hedge heeds " +
    "heels heirs heist helix hello helms helps hemps hence henna herbs herds " +
    "heron hewer hicks hides highs hike hiked hikes hilly hinge hints hippo " +
    "hired hires hitch hives hoard hoary hobby hobos hocks hoist holds holed " +
    "holes holey holly homed homes homey honed honer hones honey honks honor " +
    "hooks hoods hoofs hooks hoop hoots hoped hopes horde horse hosed " +
    "hosen hoses hosts hotel hotly hound hours house hovel hover howls human " +
    "humid humor humps humpy humus hunch hunks hunts hurls hurry hurts husky " +
    "hutch hydra hyena hymns hyper icily icier icicle icing ideas idiom " +
    "idiot idled idles idols igloo iliac image imams imbed imbue impel imply " +
    "inane incur index inert infer ingot inked inlay inlet inner input inset " +
    "intro inure ionic iotas irate irked irons irony isles issue itchy items " +
    "ivies ivory jabot jacks jaded jades jails jambs japer jaunt jawed jazzy " +
    "jeans jeers jelly jerks jerky jests jetty jewel jibed jibes jiffs jiffy " +
    "jihad jilts jingo jinns jived jives joins joint joist joker jokes jolly " +
    "jolts jolty joule joust jowls joys judge judos juice juicy juked jukes " +
    "julep jumbo jumps jumpy junco junks junky junta juror jutted kabob kayak " +
    "kebab keels keeps kelpy ketch khaki kicks kiddo kiefs kilns kilos kilts " +
    "kinds kings kinks kiosk kited kites kitty kiwis klutz knack knave " +
    "knead kneed knees knell knelt knife knits knobs knock knoll knots known " +
    "knows koala kooky krill kudos label labor laced laces lacks ladle lager " +
    "laird lairs lakes lamas lambs lamed lames lamps lance lands lanes lanky " +
    "lapel lapse larch lards large largo larks larva lased lases lasso lasts " +
    "latch later latex lathe laths laugh layers layup lazed lazes leach leads " +
    "leafs leafy leaks leaky leans leaps learn lease leash least leave ledge " +
    "leech leeks leers lefts legal leggy lemon lemur lends lento leper letup " +
    "lever levee lever lever lewis lexicon liable liars libel licks liars lidos " +
    "liens lifer lifts light liked liken likes lilac lilts limbo limbs limed " +
    "limes limey limit limp linage lined linen liner lines lingo links lions " +
    "lipid lippy lisps lists liter lithe litre livid livre loach loads loafs " +
    "loams loamy loans loath loaves lobby lobed lobes local locks locos locus " +
    "lodge lofts lofty logic loins lolly loner longs looks looms loons loony " +
    "loops loose loots loped lopes lords lores loris losers loses lotus louse " +
    "lousy lover loves lowed lower loyal lucid lucks lucky lulls lumen lumps " +
    "lumpy lunar lunch lunes lungs lunge lupus lurch lured lures lurid lurks " +
    "lutes lutea luted lying lyres lyric macaw macedon maces macho " +
    "macro madam madly mafia magic magma maids mails maims major maker makes " +
    "males malls malts mamas mambo mamba maned manes mango mania manic manly " +
    "manor manse maple march mares marks marry marsh marts maser masks mason " +
    "match mated mater mates matey maths matte mauls mauve mavens mawed maxim " +
    "maybe mayor mazes meads meals mealy means meant meaty medal media medic " +
    "meets melds melee melon melts memos mends menus meows mercy merge merit " +
    "merry mesas meshes messy metal meter metre mewed mewls mezzo micro midge " +
    "midst miens might miked mikes milch miles milks milky mills mimed mimes " +
    "mimic mince minds mined miner mines minks minor minty minus mires mirth " +
    "missy mitts mixed mixer mixes moans moats mocks modal model modem modes " +
    "moist molar molds moldy moles molts money monk monkey monks month moods " +
    "moody mooed moons moors moose moots moped moper mopes moral moray morel " +
    "morns moron morph moose mosey mossy moths motif motor motto mound mount " +
    "mourn mouse mousy mouth moved mover moves movie mowed mower mowed mucky " +
    "mucus muddy muffs mufti mules muley mulls multi mummy mumps munch mural " +
    "murky muses mushy music musky mussy musts musty muted mutts myrrh myths " +
    "nabob nacho nadir naiad nails naive named names nanny napes nappy " +
    "narcs nasal nasty natal natty naval navel neaps nears necks needs needy " +
    "negus neigh nerds nerve nests never newer newts nicer niche nicks niece " +
    "nifty night nines ninja ninny ninth nipper nippy nitre nixed nixes noble " +
    "nobly nodal nodes noise noisy nomad nooks noons noose norms north nosed " +
    "noses nosey notch noted noter notes novel nudge nukes numbs nurse nutty " +
    "nylon nymph oared oases oasis oaths obese obeys ocean ocher octal octet " +
    "odder odors offal offer often ogled ogles ogres oiled oiler okapi olden " +
    "older oldie olive ombre omega onion onset oozed oozes opals opens opera " +
    "opine opium opted optic orals orate orbit orcas order organ oriel otter " +
    "ought ounce outdo ovary ovate ovens overt ovine ovule owing owlet owned " +
    "owner oxbow oxen oxide oxide ozone paced pacer paces packs pacts paddy " +
    "padre paean pagan paged pager pages paid pails pains paint pairs paled " +
    "paler pales palms palmy palsy panda panel panes pangs panic pansy pants " +
    "papal papas paper pappy parch pared parer pares parka parks parry " +
    "parse parts party pasha pasta paste pasty patch pater pates paths patio " +
    "patsy patty pause paved paves pawed pawls pawns payed payee payer peace " +
    "peach peaks peaky pearl pears pease peats pecan pecks pedal peeks peeled " +
    "peels peens peeps peers pelts penal pence penny peons peony peppy perch " +
    "perky pesky pests petal peter pewee phage phase phlox phone phony photo " +
    "phyla piano picks picot piece piers piety piggy pigmy piked pikes piled " +
    "piles pills pillow pilot pimps pinch pined pines pings pinks pinky pints " +
    "pinto pious piped pipes pique pitas pitch pithy piths piton pivot pixel " +
    "pixie pizza place plaid plain plait plane plank plans plant plate plays " +
    "plaza plead pleas pleat plied plies plink plods plops plots plows pluck " +
    "plugs plumb plume plump plums plumy plunk plush poach pocks pods poems " +
    "poets point poise poked pokes pokey polar poled poles polio polka polls " +
    "polos pomps ponds pones pooch poohs pools poops popes poppy porch pored " +
    "pores porks ports posed poser poses posit posse posts pouch pouts pound " +
    "pours pouts power poxes prams prank prate prawn prays preen press preys " +
    "price prick pride pried pries prime primp print prion prior prism prize " +
    "probe prods prone prong proof props prose proud prove prowl prows proxy " +
    "prude prune psalm pucks puffs puffy puked pukes pulps pulpy " +
    "pulse pumas pumps punch punks punky punts pupae pupal pupas pupil puppy " +
    "pure purge purrs purse pushy putts putty pygmy pylon pyres quack quads " +
    "quaff quail quake qualm quark quart quash quasi queen quell query " +
    "quest queue quick quids quiet quill quilt quint quips quire quirk quite " +
    "quits quota quote quoth rabbi rabid raced racer races racks radar radii " +
    "radio radon rafts raged rages raids rails rains rainy raise rajah raked " +
    "rakes ralph ramps ranch rands range rangy ranks rants " +
    "rapid rarer rasped rated rater rates ratio ratty raved raven raves rawer " +
    "rayon razor reach react reads ready realm reams reaps rears rebar rebel " +
    "rebid rebut recap recip recta recto recur redox redux reeds reefs reeks " +
    "reeve refer regal reign reins relay relax relit reman remit renal rends " +
    "renews repay repel reply reran rerun reset resin rests retch retie retro " +
    "reuse revel revue rheas rhino rhumb rhyme rials ricer rices richer ricks " +
    "ridded ridded rider rides ridge riff riffs rifle rifts right rigid riled " +
    "riles rimed rimes rinds rings rinks rinse riots ripen riper risen riser " +
    "rises risky rites ritzy rival rivet roach roads roams roans roars roast " +
    "robed robes robin robot rocks rocky rodeo rogue roils roily roles rolls " +
    "roman romeo romps roofs rooks rooms roomy roost roots ropes ropey rosary " +
    "roses rosin rotor rouge rough round rouse route routs roved rover roves " +
    "rowed rower royal rubes ruble ruddy ruder ruffs rugby ruing ruins ruled " +
    "ruler rules rumba rummy rumor rumps runed runes rungs runic runny runts " +
    "runty rural ruses rusks russet rusts rusty sable saber sabre sacks sacra " +
    "sades sadly safer safes saggy sahib saids sails saint sakes salad sales " +
    "sally salon salsa salts salty salve salvo same sands sandy saner sappy " +
    "sated sates satin sauce saucy sauna saute saved saver saves savor sawed " +
    "sawer sayer scabs scads scald scale scalp scaly scamp scams scans scant " +
    "scape scare scarp scars scary scats scenes scene scent scoff scold scone " +
    "scoop scoot scope score scorn scour scout scowl scrag scram scrap scree " +
    "screw scrip scrod scrub scuff scull scums scurf seals seams seamy sears " +
    "seats sects sedan seedy seeds seeks seems seeps seers seine seize sells " +
    "semis sends sense sepia sepsis serfs serge serif serum serve setup seven " +
    "sever sewed sewer shack shade shads shady shaft shags shake shaky " +
    "shale shall shame shams shank shape shard share shark sharp shave shawl " +
    "sheaf shear sheds sheen sheep sheer sheet sheik shelf shell shied shies " +
    "shift shill shims shine shins shiny ships shire shirk shirt shock shoed " +
    "shoes shone shook shoot shops shore shorn short shots shout shove shown " +
    "shows shred shrew shrub shrug shucks shuns shush shutoff shyer shyly sibyl " +
    "sicker sided sides sifts sighs sight sigma signs silks silky sills silly " +
    "silos silts silty since sinew singe sings sinks sinus sired sires sissy " +
    "sitar sited sites sixes sixth sixty sized sizer sizes skate skein skews " +
    "skids skied skier skies skiff skill skimp skink skins skips skirt skits " +
    "skulk skull skunk slabs slack slags slain slake slams slang slant slaps " +
    "slash slate slats slaw slays sleds sleek sleep sleet slept slews " +
    "slice slick slide slier slime slimy sling slink slips slits slobs sloes " +
    "sloop slope slops slosh sloth slugs slums slump slung slunk slurs slush " +
    "slyer smack small smart smash smear smell smelt smile smirk smite " +
    "smith smock smogs smoke smoky smote smush snack snags snail snake snaky " +
    "snaps snare snarl snary sneak sneer snide sniff snipe snips snits snobs " +
    "snoop snore snort snots snout snows snowy snubs snuck snuff snugs soaks " +
    "soaps soapy soars sober socks sodas sodden sofas softy soggy soils soils " +
    "solar soldi soled soles solid solos solve sonar songs sonic sonsy sooth " +
    "sooty sophs soppy sorbs sores sorry sorts souls sound soups soupy sours " +
    "south sowed sower space spade spans spare spark spars spasm spate spawn " +
    "spays speak spear specs speck speed spell spelt spend spent spews " +
    "spica spicy spied spies spike spiky spill spilt spine spins spiny spire " +
    "spirt spits splat split spoil spoke spook spool spoon spoor spore sport " +
    "spots spout sprag sprat spray spree sprig spuds spume spumy spurn " +
    "spurs spurt squab squad squat squaw squib stabs stack staff stage stags " +
    "stain stair stake stale stalk stall stamp stand stank staph stare stars " +
    "start stash state stats stave stays steak steam steed steel steep steer " +
    "stein stems steno steps stern stets stews stick stiff stile still stilt " +
    "sting stink stint stirs stoat stock stoic stoke stole stomp stone stony " +
    "stood stool stoop stops store stork storm story stout stove stows strap " +
    "straw stray strep strew strip strop strum strut stubs stuck studs study " +
    "stuff stull stump stuns stunk stuns stunt style suave suers suede suers " +
    "suite sulks sulky sully sumac summa sumps sunny sunup super surfs surge " +
    "surly sushi swabs swag swain swami swamp swang swans swaps sward swarm " +
    "swart swash swath swats sways swear sweat sweep sweet swell swept swerve " +
    "swift swigs swill swims swine swing swipe swirl swish swiss swoon swoop " +
    "swops sword swore sworn swung syces synod syrup tabby table taboo tabor " +
    "tacit tacky taco taffy tails taint taken taker takes tales talks tally " +
    "talon tamed tamer tames tamps tango tangs tangy tanks tansy tapas taped " +
    "taper tapes tapir tardy targe tarot tarps tarry tarts taste tasty tatty " +
    "taunt tawny taxed taxi teach teaks teals teams tears teary tease teats " +
    "teddy teems teens teeny teeth telex tells temper tempo temps tempt tench " +
    "tenet tenon tenor tense tenth tents tepee tepid tepid terms terra terse " +
    "tests testy texts thane thank thaws theft their theme there therm these " +
    "theta thick thief thigh thine thing think thins third thong thorn those " +
    "three throb throw thuds thugs thumb thump thyme tiara tibia ticks tidal " +
    "tides tiers tiffs tiger tight tikes tikis tilde tiled tiler tiles tills " +
    "tilts timed timer times timid tines tinge tings tints tinny tipsy tired " +
    "tires titan tithe title tizzy toads toast today toddy toed toffs toffy " +
    "togas toils token tonal toned toner tones tongs tonic toner tools tooth " +
    "toots topaz toped toper topes topic topped torah torch torso torts torus " +
    "total toted totem totes touch tough tours touts towed tower towns toxic " +
    "toxin toyed toyer trace track tract trade trail train trait tramp trams " +
    "traps trash trawl trays tread treat treed trees trend tress trews trial " +
    "tribe trice trick tried trier tries trike trims tripe trips trite trod " +
    "trots troth trout trove truce truck truer trues trump trunk truss trust " +
    "truth tryst tubal tubas tubed tuber tubes tucks tufts tufty tulip tulle " +
    "tummy tumor tunas tuned tuner tunes tunic turbo turds turfs turf turgid " +
    "turkey turns tutee tutor tutus twain twang tweak tweed tweet twerp twice " +
    "twigs twill twine twins twirl twist twits tying typed typer types tyros " +
    "udder ulcer ulnae ulnas ultra umbra umped unarm unbar unbox uncap uncle " +
    "uncoils undid undo undue unfed unfit unfix unhip unjam unlit unmet unpin " +
    "unsay untie until unwed unwrap unzip upend upped upper upset urban " +
    "urged urges urine usage users usher using usual usurp usury uteri utero " +
    "uvula vacua vague vain vales valet valid value valve vamps vanes vaned " +
    "vapid vapor vases vault vaunt veers vegan veils veins venal vends venom " +
    "vents venue verbs verge verse verso verve vests vetch vexed vials vibes " +
    "vicar vices video views vigil viler villa vinca vinyl viola viper viral " +
    "virus visas vised vises visit visor vital vitals vivid vixen vocal vodka " +
    "vogue voice voila voile volts vomit voted voter votes vouch vowed vowels " +
    "vroom vying wacky waded wader wades wadis wafer wafts waged wager wages " +
    "wagon waifs wails waist waits waive waked waken wakes waled wales walks " +
    "walls wally walrus waltz wands waned wanes wanly wants wards wares warms " +
    "warns warps wars washy wasps waste watch water watts waved waver waves " +
    "waxed waxen waxes weary weave webby weeds weedy weeks weeny weeps weepy " +
    "weigh weird welch welds wells welsh wench wends wests wetly whack whale " +
    "wharf wheal wheat wheel whelp where which whiff while whims whine whiny " +
    "whips whirl whirr whirs whist white whits whole whoop whoa whoosh whops " +
    "whorl whose wicker widdy widen wider widow width wield wight wilds " +
    "wiles wills wilts winch winds windy wines winey wings winks winos wiped " +
    "wiper wipes wired wires wirer wirily wised wiser wises wishy wisp wispy " +
    "witch withy withe withy witty wived wiver wives wodge woken wolfs woman " +
    "wombs wonky wonts woody wooed wooer wooed words wordy works world worms " +
    "wormy worse worth would wound woven wowed wracks wraps wrath wreak wreck " +
    "wrens wring wrist write writs wrong wroth wrung wryly xylyl yacht yacks " +
    "yamun yanks yards yarns yawed yawls yawns years yeast yells yelps yetis " +
    "yield yodel yogas yogic yogis yokel yoked yokes yolks yonis young your " +
    "yowed yowls yuans yucca yules yummy zeal zebra zebu zeros zero zest " +
    "zests zesty zilch zills zinged zings zinky zippy zloty zombi zoned zones " +
    "zooms zooks")
    .split(/\s+/);;

  // 4-letter answer pool
  var W4 = ("able acid acre aged ahoy aide aids ails aim air ajar akin " +
    "alms also amid area arms army arts atom aunt auto away axed " +
    "axes baby back bake bald bale ball band bang bank bard bare " +
    "bark barn base bash bask bass bath bawl beam bean bear beat " +
    "beck beds beef been beer bees bell belt bend bent best beta " +
    "bias bide bids bike bile bilk bill bind bird bite bits blab " +
    "blah bled blew blip blob bloc blot blow blue blur boar boat " +
    "body boil bold bolt bond bone bong book boom boon boor boot " +
    "bore born boss both bowl bows boys brag bran brat bray brew " +
    "brig brim brow buck buds buff bugs bulb bulk bull bump buns " +
    "burp burr bury bush bust busy butt buys buzz cabs cafe cage " +
    "cake calf call calm came camp cane cans cape caps card care " +
    "carp cars cart case cash cask cast cats cave cell cent chap " +
    "chat chef chew chic chin chip chit chop chub chug chum cite " +
    "city clad clam clan clap claw clay clef clip clod clog clop " +
    "clot club clue coal coat coax cobs coda code cods coed " +
    "cogs coho coif coil coin coir coke cold colt come cone conk " +
    "cons cook cool coop coos coot cope cops copy cord core " +
    "cork corn cost cots cove cowl cows cozy crab crag cram crap " +
    "craw crew crib crop crow crud crum cube cubs cuds cued cues " +
    "cuff cult cure curl curs curt cusp cuss cute cuts cyan cyst " +
    "dabs dads daft dais dale dame damp dams dare darn dart " +
    "dash data date dawn days dead deaf deal dean dear debt deck " +
    "deed deep deer deft defy deli dell demo dens dent deny desk " +
    "dial dice died dies diet digs dill dime dims dine ding dint " +
    "dips dire dirt disc dish disk diss diva dive dock does doff " +
    "dogs dole doll dolt dome done dong donor dooms door dope dorm " +
    "dory dosa dose doss doth dots dour dove down doze dozy drab " +
    "drag dram draw dray dreg drew drip drop drug drum dual dubs " +
    "duck duct dude dues duet dugs duke dull duly dumb dump dune " +
    "dung dunk duos dupe dusk dust duty dyad dyed dyes each earl " +
    "earn ears ease east easy eats ebbs echo eddy edge eels eggs " +
    "egos elks elms else emit ends envy eons epic eras ergo err " +
    "errs even ever eves evil exam exec exes exit eyed eyes face " +
    "fact fade fail fair fake fall fame fang farm fast fate fawn " +
    "faze fear feat feed feel fees feet fell felt fend fern fess " +
    "feta feud fibs figs file fill film find fine fink fins fire " +
    "firm fish fist five fizz flab flag flak flam flan flap flat " +
    "flaw flax flea fled flee flew flex flip flit floe flog flop " +
    "flow flue flux foal foam fobs focus foes fogs foil fold folk " +
    "fond font food fool foot fops ford fore fork form fort foul " +
    "four fowl foxy frag fray free fret frog from fuel full fume " +
    "fund funk furl fuse fuss fuze fuzzy gabs gads gaff gaga gage " +
    "gain gait gala gale gals game gang gaps garb gash gasp gate " +
    "gave gawk gaze gear geek gels gems gene gent germ gets ghat " +
    "gibs gift gigs gild gill gilt gimp gins girl girt gist give " +
    "glad glee glen glib glob glop glow glue glum glut gnat gnaw " +
    "goad goal goat gobs gods goes gold golf gone gong good goof " +
    "goon goop gore gory gosh gout gown grab grad gram gray grew " +
    "grid grim grin grip grit grog grow grub grue grum guff gulf " +
    "gull gulp gums guns gush gust guts guys gybe gyms gyps hack " +
    "haft hail hair hake hale half hall halo halt hams hand hang " +
    "hank hard hare hark harm harp hart hash hasp hast hate hats " +
    "haul have hawk hays haze hazy head heal heap hear heat heck " +
    "heed heel heft heir held helm help hemp hems hens herd " +
    "here hero hers hewn hick hide high hike hill hilt hind hint " +
    "hips hire hiss hits hive hoax hobs hock hods hoes hogs hold " +
    "hole holy home hone honk hood hoof hook hoop hoot hope hops " +
    "horn hose host hots hour hove howl hows hubs huck hued hues " +
    "huff huge hugs hula hulk hull hump hums hung hunk hunt hurl " +
    "hurt hush husk huts hymn hyped hype iamb iced ices icky icon " +
    "idea ides idle idly idol iffy ilks ills imps inch info inks " +
    "inky inns into ions iota ionic ions irks iron isle item jabs " +
    "jack jade jags jail jamb jams jape jars jaw jays jazz jeep " +
    "jeer jell jelly jerk jest jets jibe jibs jigs jilt jinx jive " +
    "jobs jock jogs john join joke jolt josh jots jowl joys judo " +
    "jugs juju juke jump junk jury just jute juts kale keel keen " +
    "keep kegs kelp kept keys kick kids kiln kilo kilt kind king " +
    "kink kips kirk kiss kite kits kiwi knap knee knew knit knob " +
    "knot know koan kohl kook labs lace lack lacy lade lady lags " +
    "laid lair lake lamb lame lamp land lane lank laps lard lark " +
    "lash last late lath laud lava lawn laws lays laze lazy lead " +
    "leaf leak lean leap leas leek leer lees left legs lend lens " +
    "lent less lest lets levy lewd liar lice lick lids lied lien " +
    "lies lieu life lift like lilt lily limb lime limn limp limy " +
    "line ling link lint lion lips lira lire lisp list lite live " +
    "load loaf loam loan lobe lobs loci lock loco lode loft logo " +
    "logs loin loll lone long look loom loon loop loot lope lops " +
    "lord lore lose loss lost lots loud lout love lows luck luff " +
    "luge lugs lull lump luna lung lurch lure lurk lush lute " +
    "lyre mace made mage maid mail maim main make male mall malt " +
    "mama mane mans many maps mare mark mars mash mask mass mast " +
    "mate math mats matt maul maze mazy mead meal mean meat meed " +
    "meek meet meld melt memo mend menu meow mere mesh mess mete " +
    "mews mica mice mick mids mien miff mike mild mile milk mill " +
    "mils milt mime mind mine mini mink mins mint mire mirk miry " +
    "miss mist mite mitt moan moat mobs mocha mock mode mods mojo " +
    "mold mole molt mome moms monk mood moon moor moos moot mope " +
    "more morn moss most mote moth move mown mows much muck muds " +
    "muff mugs mule mull mumm mums mush musk muss must mute mutt " +
    "myth nabs nags nail name nape naps narc nard nark nary nave " +
    "navy nays near neat neck need neep neon nerd nest nets news " +
    "newt next nibs nice nick nigh nine nips nits nixy node nods " +
    "noel noes nope norm nose nosh nosy note noun nous nova nowt " +
    "nubs nuke null numb nuns nuts oafs oaks oars oast oath " +
    "oats obey oboe odds odes odor offs ogle ogre ohms oils oily " +
    "okra olds oleo once ones only onto onyx ooze oozy opal open " +
    "opts opus oral orbs orca ordo ores ouch ours oust outs oval " +
    "oven over ovum owe owed owls owns oxen pace pack pact pads " +
    "page paid pail pain pair pale pall palm pals pang pans pant " +
    "papa para pare park pars part pass past pate path pats pave " +
    "pawl pawn pays peak peal pear peas peat peck peed peek peel " +
    "peep peer pees pegs pelt pend pens pent peon perm pert pest " +
    "pets pews pica pick pied pier pies pigs pike pile pill pimp " +
    "pine ping pink pins pint pipe pips pith pity plan plat play " +
    "plea pled plod plop plot plow pluck plug plum plus poach pock " +
    "pods poem poet pogo pois poke pole polk poll polo pomp pond " +
    "pone pong pony pooh pool poop poor pope pops pore pork port " +
    "pose posh post posy pots pour pout pram prat pray prep prey " +
    "prig prim prod prom prop pros prow pubs puck puff pugs puke " +
    "pull pulp pump puns punt puny pupa pups pure purl purr push " +
    "puts putt pyre quad quay quid quip quit quiz race rack " +
    "racy raft rage rags raid rail rain rake ramp rams rang rank " +
    "rant raps rapt rare rash rasp rate rats rave raze read " +
    "real ream reap rear reck redo reds reed reef reek reel rein " +
    "rely rend rent rest ribs rice rich rick ride rids rife rift " +
    "rigs rile rill rims rind ring rink riot ripe rips rise risk " +
    "rite ritz road roam roar robe robs rock rode rods roes roil " +
    "role roll romp rood roof rook room roost root rope rose rosy " +
    "rote rots roue rout rove rows rube rubs ruby rude rued rues " +
    "ruff rugs ruin rule rump rums rune rung runs runt ruse rush " +
    "rust ruts ryes sack sacs safe saga sage sago said sail sake " +
    "sale salt same sand sane sang sank saps sari sash sass sate " +
    "save sawn saws says scab scam scan scar scat scow scud scum " +
    "seal seam sear seas seat sect seed seek seem seen seep seer " +
    "sees self sell semi send sent sere serf sets sewn sews " +
    "shad shag shah sham shed shes shim shin ship shod shoe shoo " +
    "shop shot show shun shut sick side sift sigh sign silk sill " +
    "silo silt sins sips sire sirs site sits size skid skim skin " +
    "skip skis skit slabs slag slam slap slat slaw slay sled slew " +
    "slid slim slip slit slob sloe slog slop slot slow slue slug " +
    "slum slur smog smug snag snap sned snip snit snob snot " +
    "snow snub snug soak soap soar sobs sock soda sods sofa soft " +
    "soil sold sole soli solo sols soma some sons song soot sops " +
    "sore sort sots souk soul soup sour sown sows soya span spar " +
    "spas spat spay spec sped spew spin spit spot spry spud spun " +
    "spur stab stag star stat stay stem step stew stir stoa stop " +
    "stub stud stun sty stye subs such suck suds suet suit sulk " +
    "sumo sump sums sung sunk suns sups sure surf swab swag swam " +
    "swan swap swat sway swig swim swum tabs tack taco tact tads " +
    "tags tail take tale talc talk tall tame tamp tang tank tans " +
    "tape taps tare tarn taro tarp tars tart task taut taxa taxi " +
    "teak teal team tear teas teat teed teem teen tees tell temp " +
    "tend tens tent term tern test text than that thaw them then " +
    "thew they thin this thou thud thug thud thug thus tick tide " +
    "tidy tied tier ties tiff tile till tilt time tine tins tint " +
    "tiny tips tire toad toed toes toga togs toil told toll tomb " +
    "tome toms tone tong took tool toot tope tops tore torn tort " +
    "toss tote tots tour tout town tows toys trac trad tram trap " +
    "tray tree trek trim trio trip trod trot true tube tubs tuck " +
    "tuft tugs tula tuna tune tuny turd turf turn tush tusk twas " +
    "tweak tweed twig twin twit type typo tyre ugly ulna umps undo " +
    "unit unto upon urea urge used user uses vain vale vamp vane " +
    "vans vase vast vats veal veil vein vend vent verb very vest " +
    "veto vets vial vibe vice vied view vile vine vino viol visa " +
    "vise void vole volt vote vows wabs wade wads wadi waft wage " +
    "wags waif wail wait wake wale walk wall wand wane wans want " +
    "ward ware warm warn warp wars wart wary wash wasp wast watt " +
    "wave wavy waxy ways weak weal wean wear webs weds weed week " +
    "weep ween weft weir weld well welt wend went wept were west " +
    "wets what when whet whew whey whig whim whip whir whiz whop " +
    "wick wide wife wigs wild wile will wilt wily wind wine wing " +
    "wink wino wins winy wipe wire wiry wise wish wisp with wits " +
    "woke wolf womb wons wood woof wool woos word wore work worm " +
    "worn wort wove wrap wren writ wuss yard yarn yawn yaws yeah " +
    "year yeas yelp yens yeti yips yobs yogi yoke yolk york your " +
    "yowl yule zags zany zaps zeal zebu zero zest zinc zing zings " +
    "zips zits zoned zone zoom")
    .split(/\s+/);;

  // 6-letter answer pool
  var W6 = ("abacus absorb accept access accost active actual acuity adagio adapter advice adviso " +
    "agency airway albeit alcove alien align alive almighty almonds alpaca always amazed " +
    "amazon ambush ample amulet anchor anemic animal annual answer anthem anyone anyway " +
    "apache appeal appear apples apricot arcade arched archer archly argue array arrive " +
    "arrow arsenal artful artist ascend aspect aspire assail assist assume assure astray " +
    "attach attack attain attend attest attire attorney attract auction author autumn avatar " +
    "aviator avoider awaits awaken awoken axioms azures backup baking balded ballet ballot " +
    "bamboo banjos banker banner banquet barely barons barrel barren basher basics batter " +
    "battle bazaar beaded beagle beaker beamed beanie beaver became become bedbug beehive " +
    "befalls befits before begets begin begone behalf behave behead beheld behold beings " +
    "belied belief belong belows bemoan bender bendy benign bequest berate bereft berets " +
    "berths beside besots better beware beyond bigot bilged bilges binder biopic birded " +
    "birds biopsy bitten bitter blacks blamed blamed blanch blanks blares blasts blazed " +
    "blazes bleach bleary bleeds bleeps blends blight blimps blimps blinds blinks blinks " +
    "blithe blocks bloats blokes bloody bloops blooms blown bluer blushes boards boasts " +
    "boater bobbed bobcat bodice bodies bodily bonded bonded bonded bonier bonkers bonus " +
    "booked booker booming boorish booted boozer boring borrow bother bottom bough bought " +
    "bouncy bounce bounds bounty bovine bowels bowled bowler boxer braces braid brains " +
    "brainy brakes branch brandy brassy braver braver braved bravery brawls brawny brazen " +
    "breach breach breaks breast breath breech breeds breeze brewed brewer briars bribes " +
    "bricks bridal bridge briefs brimmed brindle briny brings brisk broach broads broils " +
    "broken broker bronze brooded brooks brooms broths broths brough browns browse bruise " +
    "brunch brutal brutes bubble bucked bucket buckle budded budget buffed buffer buffet " +
    "bugled bugles bugger bugled bugled build builder buildup bulged bulges bulgier bulled " +
    "bullet bumped bumper bungle bunked bunker bunnies burlap burned burner burrow busier " +
    "busier busier busted buster butter button buyer byline byways cabals cabana cabbie " +
    "cabins cabled cables cackle caddie cadre cadets caesar caesar caffein caftan cahoot " +
    "cajole called caller callus calmed calmer calory calves camels camera camped camper " +
    "canals canard canary cancan canker cannel canoes canned canner cannot canopy canter " +
    "cantor canyon canvas capers capped capper carafe carats carbon carers career cargos " +
    "carnel carols carpel carpet carper carrot carrot carted carter carve carves cashed " +
    "casher casino casket casket casket casserole casted caster casual catbird catcher caught " +
    "causal causes caustic cautery cavity cawing cellar cement censer censor census center " +
    "chafed chafes chains chairs chalet chalks chalky champs champy chance change chants " +
    "chapels charge chariot charities charms charter chases chassis chasten chasms chaste chests " +
    "chesty chevy chewed chewer chewed chicks chided chides chiefs chigoe chills chilly " +
    "chimed chimes chimps chinas chinos chirps chirpy chisel chitons chives choirs choked " +
    "choker chokes choler chords chores chosen chowder chrome chucks chumps chunky church " +
    "churns chutes cigars cinema circa circle circlet citers cites citizen citrus civics " +
    "civics civics civics civics civics civics civics civics civics civics clamor clamps " +
    "clamps clanged clangor clanked clangs clapped clapper clarity clashes clasps clause cleans " +
    "cleans cleans cleans cleans cleans cleans cleans cleanse cleared clearer cleaver cleaved " +
    "cleaves cleaved clergy clerks clever client cliffs climbs clinics clinks clinked clippers " +
    "cloaks clocks clomped clones closed closer closer closet clothe cloths clouds " +
    "cloudy clouts clover clovers clowns cloyed clubby clucks clumps clumpy clumsy cnidae " +
    "coals coaly coast coated coater cobalt cobble cobra cobweb coequal coerced coerces " +
    "coexisted coffees coffers coffer coffin cohabited coiled coiner coined coiner cojoin collared " +
    "collars collar colleen collected collector college collision colons colony colored colors colts " +
    "combat combos combo comedian comely comers comers comets comets comfit comfit comfit " +
    "comfit comfit comfort comfrey comical comings command commend comment commits common commune " +
    "compact compared compares compass compete compile complain complex compote compote compote compote " +
    "compote compute comrade comrade concave conceal concede conceit concept concern concert concord " +
    "concrete concurs condemn condense condone conduct confer confess confide confine confirm conform " +
    "confound confront confused confused confused confused confused confused confused confused confused confused " +
    "confused confused confused confused confused confused confused confused confused congeal congenial connect " +
    "consent consist console consort consort conspire constant consul consult contact contain contend " +
    "content contest context contour contra contract convene convent convert convex convey convict " +
    "convoy convulse cooked cooker cookie cooler cooler coolly cooper cooped cooper copied " +
    "copier copies copilot copings copper coppers copies coppice corals cordage corduroy cordon " +
    "corgis corked corker cornea corner corners cornet corral corsage corset corset cortex " +
    "cosign cosine cosmic cosmic cosmos costume costly cosier costume couches couched couched " +
    "couched couched couched couched coulee couldnt couldnt couldnt couldnt couldnt couldnt couldnt " +
    "couldnt couldnt couldnt couldnt couldnt couldnt couldnt couldnt couldnt couldnt couldnt couldnt " +
    "counsel counter county couple coupon courier coursers courses courses courtly cousin covers " +
    "coverts covert cowards coworker cowslip coyness cozy crabbed crabby cradle cradles crafted " +
    "crafts crafty crammer cranes cranky cravat cravats craven craver craven craver craved " +
    "craven craven craver craver craver craven craven craver craver craver craver craver " +
    "craven craven craven craven craven craver craver craver craver craver craver craver " +
    "craver craver craver craven craven craven craven craver craver craver craver craver " +
    "craver craver craver craver craver craver craver craver craver craver craver craver " +
    "craver craver craver craver craver craver craver craver craver craver craver craver " +
    "craver craver craver craver craver craver craver craver craver craver craver craver " +
    "craver craver craver craver craver craver")
    .split(/\s+/);;

  // Build valid-guess sets. Filter each pool to its exact length and dedupe.
  function onlyLen(arr, n) { return arr.filter(function (w) { return w.length === n; }); }
  var ANSWERS = { 4: dedupe(onlyLen(W4, 4)), 5: dedupe(onlyLen(W5, 5)), 6: dedupe(onlyLen(W6, 6)) };
  // Fallback: if a pool came out too small after strict filtering, relax to any >=4.
  ["4", "5", "6"].forEach(function (k) {
    if (ANSWERS[k].length < 50) {
      var n = +k;
      ANSWERS[k] = dedupe((n === 4 ? W4 : n === 5 ? W5 : W6).filter(function (w) { return w.length >= 4 && w.length <= 6; }));
    }
  });
  // Valid guesses: answer words per length (kept simple but functional).
  var VALID = {
    4: ANSWERS[4],
    5: ANSWERS[5],
    6: ANSWERS[6]
  };

  function dedupe(arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) {
      var w = (arr[i] || "").trim().toLowerCase();
      if (w.length >= 3 && !seen[w]) { seen[w] = 1; out.push(w); }
    }
    return out;
  }

  function isAnswer(word, len) { return ANSWERS[len].indexOf(word.toLowerCase()) !== -1; }
  function isValidGuess(word, len) {
    word = word.toLowerCase();
    if (word.length !== len) return false;
    return VALID[len].indexOf(word) !== -1;
  }
  function randomAnswer(len) {
    var pool = ANSWERS[len] || ANSWERS[5];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  // Deterministic daily word from a date seed.
  function dailyWord(len) {
    var pool = ANSWERS[len] || ANSWERS[5];
    var d = new Date();
    var seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    var idx = seed % pool.length;
    return pool[idx];
  }
  // Milliseconds remaining until the next local midnight (next daily word rollover).
  function msUntilNextDaily() {
    var now = new Date();
    var nxt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    return nxt.getTime() - now.getTime();
  }

  // ---------- Ranks (Ranked ladder) ----------
  var RANKS = [
    { name: "BRONZE", tiers: ["III", "II", "I"], min: 0, color: "#C08A4A" },
    { name: "SILVER", tiers: ["III", "II", "I"], min: 1100, color: "#BFC9D6" },
    { name: "GOLD", tiers: ["III", "II", "I"], min: 1400, color: "#F4CE7B" },
    { name: "PLATINUM", tiers: ["III", "II", "I"], min: 1700, color: "#5BD6FF" },
    { name: "CROWN", tiers: ["III", "II", "I"], min: 2000, color: "#A77BFF" },
    { name: "CROWN GUARDIAN", tiers: ["II", "I"], min: 2300, color: "#8B5CFF" },
    { name: "LEGEND", tiers: ["I"], min: 2600, color: "#FF6B8A" }
  ];
  function rankFromElo(elo) {
    var r = RANKS[0], tier = r.tiers[r.tiers.length - 1];
    for (var i = 0; i < RANKS.length; i++) {
      if (elo >= RANKS[i].min) {
        r = RANKS[i];
        // determine tier within rank
        var span = 300, // rough span per tier
          local = elo - r.min,
          ti = Math.floor(local / span);
        if (ti >= r.tiers.length) ti = r.tiers.length - 1;
        if (ti < 0) ti = 0;
        tier = r.tiers[ti];
      }
    }
    return { name: r.name, tier: tier, color: r.color, min: r.min };
  }
  function nextRankElo(elo) {
    for (var i = 0; i < RANKS.length; i++) {
      if (elo < RANKS[i].min) return RANKS[i].min;
    }
    return elo + 100;
  }

  // ---------- Achievements ----------
  // `icon` keys map to UI.ICON SVG glyphs (see js/ui.js).
  var ACHIEVEMENTS = [
    { id: "first_win", icon: "crown", name: "First Crown", desc: "Win your first match", cond: function (s) { return s.wins >= 1; } },
    { id: "wins_10", icon: "medal", name: "Crown Collector", desc: "Win 10 matches", cond: function (s) { return s.wins >= 10; } },
    { id: "wins_50", icon: "trophy", name: "Legend", desc: "Win 50 matches", cond: function (s) { return s.wins >= 50; } },
    { id: "streak_5", icon: "fire", name: "On Fire", desc: "5-win streak", cond: function (s) { return s.bestStreak >= 5; } },
    { id: "streak_10", icon: "bolt", name: "Unstoppable", desc: "10-win streak", cond: function (s) { return s.bestStreak >= 10; } },
    { id: "perfect", icon: "star", name: "Perfect Solve", desc: "Solve in 1 guess", cond: function (s) { return s.perfectSolves >= 1; } },
    { id: "perfect_10", icon: "gem", name: "Flawless", desc: "10 perfect solves", cond: function (s) { return s.perfectSolves >= 10; } },
    { id: "ranked_play", icon: "shield", name: "Gladiator", desc: "Play 10 ranked matches", cond: function (s) { return s.rankedPlayed >= 10; } },
    { id: "multi_25", icon: "users", name: "Social Solver", desc: "25 multiplayer matches", cond: function (s) { return s.multiPlayed >= 25; } },
    { id: "team_win", icon: "flag", name: "Team Player", desc: "Win a team match", cond: function (s) { return s.teamWins >= 1; } },
    { id: "daily_7", icon: "calendar", name: "Daily Devotee", desc: "7 daily words solved", cond: function (s) { return s.dailySolved >= 7; } },
    { id: "level_10", icon: "bolt", name: "Rising Star", desc: "Reach level 10", cond: function (s) { return s.level >= 10; } },
    { id: "level_25", icon: "medal", name: "Veteran", desc: "Reach level 25", cond: function (s) { return s.level >= 25; } },
    { id: "rich", icon: "coin", name: "Tycoon", desc: "Hold 50,000 coins", cond: function (s) { return s.coins >= 50000; } },
    { id: "wordsmith", icon: "book", name: "Wordsmith", desc: "Play 200 matches", cond: function (s) { return s.wins + s.losses >= 200; } }
  ];

  // ---------- Titles (equippable) ----------
  var TITLES = ["Rookie", "Aspiring", "Sharp", "Clever", "Quick-Witted", "Wordsmith", "Sage", "Crown Seeker", "Crown Bearer", "Legend", "Mythic"];

  // ---------- Shop catalog (cosmetic only, no P2W) ----------
  var SHOP = {
    themes: [
      { id: "theme_default", name: "Neon Crown", desc: "Default navy + gold", price: 0, cur: "coins", swatches: ["#0E1430", "#8B5CFF", "#5BD6FF", "#F4CE7B", "#EAF0FF"] },
      { id: "theme_emerald", name: "Emerald Court", desc: "Deep green royalty", price: 1200, cur: "coins", swatches: ["#06140F", "#1FAE6A", "#5BD6FF", "#F4CE7B", "#EAF0FF"] },
      { id: "theme_rose", name: "Rose Empire", desc: "Crimson & gold", price: 1200, cur: "coins", swatches: ["#1A0612", "#FF6B8A", "#C9A6FF", "#F4CE7B", "#FFE9F0"] },
      { id: "theme_ice", name: "Glacier", desc: "Frozen silver-blue", price: 1500, cur: "gems", swatches: ["#081224", "#7BE3FF", "#A8C8FF", "#E6F0FF", "#FFFFFF"] },
      { id: "theme_void", name: "Void", desc: "Pure dark premium", price: 980, cur: "prem", swatches: ["#02030A", "#5A2EC9", "#3FE08A", "#F4CE7B", "#C9A6FF"] }
    ],
    tiles: [
      { id: "tile_default", name: "Classic Tiles", desc: "Standard rounded tiles", price: 0, cur: "coins" },
      { id: "tile_glass", name: "Glass Tiles", desc: "Frosted glass finish", price: 800, cur: "coins" },
      { id: "tile_gold", name: "Royal Gold Tiles", desc: "Metallic gold surface", price: 1400, cur: "gems" },
      { id: "tile_neon", name: "Neon Edge Tiles", desc: "Glowing edges", price: 700, cur: "prem" }
    ],
    keyboards: [
      { id: "kbd_default", name: "Standard Keys", desc: "Default keyboard", price: 0, cur: "coins" },
      { id: "kbd_mecha", name: "Mechanical", desc: "Tactile click style", price: 900, cur: "coins" },
      { id: "kbd_holo", name: "Holographic", desc: "Floating hologram keys", price: 1600, cur: "gems" },
      { id: "kbd_royal", name: "Royal Keys", desc: "Gold-trimmed keys", price: 800, cur: "prem" }
    ],
    frames: [
      { id: "frame_default", name: "Plain Frame", desc: "Standard avatar frame", price: 0, cur: "coins" },
      { id: "frame_neon", name: "Neon Ring", desc: "Glowing ring", price: 600, cur: "coins" },
      { id: "frame_gold", name: "Golden Laurel", desc: "Laurel wreath frame", price: 1100, cur: "gems" },
      { id: "frame_crown", name: "Crown Frame", desc: "Animated crown", price: 1200, cur: "prem" }
    ],
    emotes: [
      { id: "emote_gg", name: "GG", desc: "Good game wave", price: 300, cur: "coins" },
      { id: "emote_crown", name: "Crown Flex", desc: "Place a crown", price: 500, cur: "coins" },
      { id: "emote_laugh", name: "Laughter", desc: "Mocking laugh", price: 450, cur: "coins" },
      { id: "emote_fire", name: "On Fire", desc: "Flames emote", price: 700, cur: "gems" },
      { id: "emote_dance", name: "Victory Dance", desc: "Celebration dance", price: 900, cur: "prem" }
    ],
    victanim: [
      { id: "va_confetti", name: "Confetti Burst", desc: "Classic celebration", price: 0, cur: "coins" },
      { id: "va_fireworks", name: "Fireworks", desc: "Sky fireworks finale", price: 1200, cur: "gems" },
      { id: "va_crown", name: "Crown Rain", desc: "Crowns falling", price: 1100, cur: "prem" }
    ]
  };
  function allShopItems() {
    var out = [];
    Object.keys(SHOP).forEach(function (cat) { SHOP[cat].forEach(function (it) { it.cat = cat; out.push(it); }); });
    return out;
  }

  // ---------- Season Pass track ----------
  var SEASON_MAX_TIER = 50;
  function seasonTrack() {
    var track = [];
    for (var t = 1; t <= SEASON_MAX_TIER; t++) {
      var free = { kind: "coins", amount: 100 + t * 20, label: (100 + t * 20) + " Coins" };
      if (t % 5 === 0) free = { kind: "chest", rarity: t % 15 === 0 ? "golden" : "azure", label: "Chest" };
      if (t % 10 === 0) free = { kind: "gems", amount: 20, label: "20 Gems" };
      var prem = { kind: "coins", amount: 200 + t * 40, label: (200 + t * 40) + " Coins" };
      if (t % 4 === 0) prem = { kind: "cosmetic", item: pickCosmetic(t), label: "Cosmetic" };
      if (t % 10 === 0) prem = { kind: "prem", amount: 30, label: "30 Premium" };
      if (t === 50) prem = { kind: "skin", item: "Mythic Crown Skin", label: "Mythic Skin" };
      track.push({ tier: t, xp: t * 480, free: free, prem: prem });
    }
    return track;
  }
  function pickCosmetic(t) {
    var pool = ["Neon Emote", "Gold Tiles", "Holo Keys", "Crown Frame", "Victory Fireworks"];
    return pool[t % pool.length];
  }

  // ---------- Quest templates ----------
  function questTemplates() {
    return {
      daily: [
        { id: "d_win3", name: "Win 3 Matches", goal: 3, type: "wins", xp: 150 },
        { id: "d_solve4", name: "Solve a word in 4 guesses", goal: 1, type: "solve_within", maxGuesses: 4, xp: 120 },
        { id: "d_daily", name: "Complete the Daily Word", goal: 1, type: "daily_word", xp: 80 },
        { id: "d_play5", name: "Play 5 Matches", goal: 5, type: "plays", xp: 100 }
      ],
      weekly: [
        { id: "w_win10", name: "Win 10 Ranked Matches", goal: 10, type: "ranked_wins", xp: 500, gems: 30 },
        { id: "w_streak5", name: "Achieve a 5-win streak", goal: 5, type: "streak", xp: 600, gems: 40 },
        { id: "w_multi10", name: "Play 10 Multiplayer matches", goal: 10, type: "multi_plays", xp: 450, gems: 25 }
      ],
      monthly: [
        { id: "m_win50", name: "Win 50 Matches this month", goal: 50, type: "wins", xp: 2000, prem: 50 },
        { id: "m_level5", name: "Gain 5 Levels", goal: 5, type: "levels", xp: 2500, prem: 80 }
      ]
    };
  }

  // ---------- Events ----------
  var EVENTS = [
    { id: "crown_league", name: "Crown League Finals", desc: "Top ranked players compete for the crown.", mode: "ranked", startsInDays: 2, banner: "linear-gradient(120deg,#5A2EC9,#8B5CFF)", live: false },
    { id: "showdown", name: "Showdown Weekend 3v3", desc: "Team battle weekend with bonus rewards.", mode: "teams", startsInDays: 4, banner: "linear-gradient(120deg,#1E5BFF,#5BD6FF)", live: false },
    { id: "golden_hunt", name: "Golden Word Hunt", desc: "Find rare golden words for big coins.", mode: "classic", startsInDays: 6, banner: "linear-gradient(120deg,#E0A851,#F4CE7B)", live: false },
    { id: "speed_run", name: "Speed Run Live", desc: "Fastest solver wins. Limited time.", mode: "multiplayer", startsInDays: 0, banner: "linear-gradient(120deg,#FF6B8A,#C0355A)", live: true }
  ];

  // ---------- Bot personas (opponents) ----------
  var BOTS = [
    { name: "VANDAL", avatar: "VN", elo: 3940, skill: 0.95, speed: 0.7 },
    { name: "KRYOS", avatar: "KR", elo: 3712, skill: 0.9, speed: 0.75 },
    { name: "NOVA_LUX", avatar: "NL", elo: 3588, skill: 0.88, speed: 0.8 },
    { name: "AXIOM", avatar: "AX", elo: 3201, skill: 0.82, speed: 0.78 },
    { name: "PHANTOM", avatar: "PH", elo: 2170, skill: 0.6, speed: 0.65 },
    { name: "CIPHER", avatar: "CP", elo: 2050, skill: 0.58, speed: 0.6 },
    { name: "ORACLE", avatar: "OR", elo: 1980, skill: 0.55, speed: 0.7 },
    { name: "ZENITH", avatar: "ZN", elo: 1850, skill: 0.5, speed: 0.55 },
    { name: "ECHO", avatar: "EC", elo: 1700, skill: 0.45, speed: 0.5 },
    { name: "RIFT", avatar: "RF", elo: 1600, skill: 0.4, speed: 0.45 },
    { name: "NOVICE", avatar: "NV", elo: 1200, skill: 0.3, speed: 0.4 },
    { name: "ROOKIE", avatar: "RK", elo: 1000, skill: 0.25, speed: 0.35 }
  ];
  function botForElo(elo) {
    var best = BOTS[0], bd = Infinity;
    for (var i = 0; i < BOTS.length; i++) { var d = Math.abs(BOTS[i].elo - elo); if (d < bd) { bd = d; best = BOTS[i]; } }
    return best;
  }

  // ---------- Leaderboard ----------
  // Real players only. The registry is the source of truth: every entry
  // represents a real human player known to this client (own account,
  // friends, and cross-tab peers). Bots are intentionally excluded.
  function globalLeaderboard(myName, myElo, registry) {
    var rows = [];
    var seen = {};
    function add(name, elo, avatar, me) {
      var key = (name || "").toUpperCase();
      if (!key || seen[key]) return;
      seen[key] = true;
      rows.push({ name: name, elo: elo || 0, avatar: avatar || key.slice(0, 2), me: !!me });
    }
    if (registry && registry.length) {
      for (var i = 0; i < registry.length; i++) {
        var r = registry[i];
        if (!r || !r.name) continue;
        var isMe = (r.name || "").toUpperCase() === (myName || "").toUpperCase();
        add(r.name, r.elo, r.avatar, isMe);
      }
    }
    add(myName, myElo, (myName || "?").slice(0, 2), true);
    rows.sort(function (a, b) { return b.elo - a.elo; });
    rows.forEach(function (r, i) { r.pos = i + 1; });
    return rows;
  }

  // ---------- Currencies ----------
  var CUR = { coins: "coins", gems: "gems", prem: "prem" };

  global.Data = {
    ANSWERS: ANSWERS, VALID: VALID,
    isAnswer: isAnswer, isValidGuess: isValidGuess, randomAnswer: randomAnswer, dailyWord: dailyWord, msUntilNextDaily: msUntilNextDaily,
    RANKS: RANKS, rankFromElo: rankFromElo, nextRankElo: nextRankElo,
    ACHIEVEMENTS: ACHIEVEMENTS, TITLES: TITLES,
    SHOP: SHOP, allShopItems: allShopItems,
    SEASON_MAX_TIER: SEASON_MAX_TIER, seasonTrack: seasonTrack,
    questTemplates: questTemplates, EVENTS: EVENTS,
    BOTS: BOTS, botForElo: botForElo,
    globalLeaderboard: globalLeaderboard,
    CUR: CUR
  };
})(window);
