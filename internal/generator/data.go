package generator

// Curated, fictitious-friendly first/last name fragments and nationality pools.
// Names are randomly composed; nothing here references real footballers.

var firstNames = []string{
	"Aiden", "Bruno", "Carlos", "Diego", "Eitan", "Felix", "Gabriel", "Hugo",
	"Ibrahim", "Jamal", "Kenji", "Luca", "Mateo", "Niko", "Omar", "Pavel",
	"Quentin", "Rafael", "Saul", "Tariq", "Umut", "Viktor", "Wesley", "Xavi",
	"Yago", "Zane", "Aleksy", "Bastien", "Cosmin", "Dario", "Emre", "Faruk",
	"Goran", "Henrik", "Ilias", "Jonas", "Kemal", "Lars", "Milos", "Nuno",
	"Oskar", "Pedro", "Ravi", "Stefan", "Teo", "Ugo", "Vasco", "Walter",
	"Yannick", "Zoran", "Adrian", "Borja", "Cristian", "Dimas", "Enzo",
	"Fede", "Gus", "Han", "Igor", "Joaquin", "Kai", "Levi", "Mads", "Nils",
}

var lastNames = []string{
	"Almeida", "Bashir", "Costa", "Duarte", "Engler", "Fontana", "Garrido",
	"Holm", "Ivanov", "Jovic", "Karadag", "Larsson", "Mendoza", "Novak",
	"Okafor", "Petrov", "Quintero", "Rashid", "Soler", "Toth", "Ugarte",
	"Vargas", "Weiss", "Xerri", "Yamamoto", "Zhao", "Akande", "Bianchi",
	"Cavalli", "Dimitrov", "Eriksen", "Fischer", "Gallego", "Haidar",
	"Iglesias", "Janssen", "Kowal", "Leandro", "Marek", "Nasser", "Ortega",
	"Park", "Ramos", "Suzuki", "Tovar", "Ueda", "Verdi", "Werner", "Yildiz",
	"Zubiri", "Aslan", "Becker", "Cazorla", "Dvorak", "Esposito", "Farah",
	"Gokcen", "Hassan", "Ikeda", "Jansen", "Kohl", "Lima", "Moretti",
}

// Nationalities are fictitious or generic enough to keep the game globally
// flavored without endorsing real federations. They span all continents.
var nationalities = []string{
	"Brazil", "Argentina", "Spain", "France", "Germany", "Italy", "Portugal",
	"England", "Netherlands", "Belgium", "Croatia", "Poland", "Sweden",
	"Norway", "Denmark", "Turkey", "Greece", "Morocco", "Senegal", "Nigeria",
	"Ghana", "Egypt", "Algeria", "South Africa", "Japan", "South Korea",
	"Australia", "Mexico", "Colombia", "Uruguay", "Chile", "USA", "Canada",
	"Serbia", "Switzerland", "Austria", "Czechia", "Romania", "Ukraine",
}

func FirstNames() []string   { return firstNames }
func LastNames() []string    { return lastNames }
func Nationalities() []string { return nationalities }

// Suggested club name fragments for AI clubs and starter clubs.
var clubPrefixes = []string{
	"Real", "Atletico", "Sporting", "Royal", "Dynamo", "Olympic",
	"United", "Inter", "FC", "Club", "AS", "VfL", "Akademia",
}

var clubSuffixes = []string{
	"Northbridge", "Riverside", "Hightower", "Coastline", "Stormgate",
	"Ironvale", "Sunhaven", "Westport", "Granitecliff", "Summerfield",
	"Highland", "Whiterose", "Greymoor", "Goldhaven", "Eastgate",
	"Crownpoint", "Southridge", "Brookline", "Lakeshore", "Pinehollow",
}

func ClubPrefixes() []string { return clubPrefixes }
func ClubSuffixes() []string { return clubSuffixes }
