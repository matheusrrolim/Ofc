// Plain DTOs mirroring the JSON the Go backend returns.
// Decoding is forgiving: unknown fields are ignored, missing fields fall back
// to sensible defaults so old clients keep working when the server adds new
// data.

class User {
  final String id;
  final String username;
  final String email;
  final String clubId;
  final int softCurrency;
  final int premiumCurrency;
  final String division;

  User({
    required this.id,
    required this.username,
    required this.email,
    required this.clubId,
    required this.softCurrency,
    required this.premiumCurrency,
    required this.division,
  });

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: (j['id'] ?? '') as String,
        username: (j['username'] ?? '') as String,
        email: (j['email'] ?? '') as String,
        clubId: (j['clubId'] ?? '') as String,
        softCurrency: (j['softCurrency'] ?? 0) as int,
        premiumCurrency: (j['premiumCurrency'] ?? 0) as int,
        division: (j['division'] ?? 'Bronze') as String,
      );
}

class Club {
  final String id;
  final String name;
  final String logo;
  final int stadiumLevel;
  final String managerId;
  final List<String> squad;
  final int chemistryScore;
  final bool isAI;
  final int wins;
  final int draws;
  final int losses;
  final int points;
  final int goalsFor;
  final int goalsAgainst;

  Club({
    required this.id,
    required this.name,
    required this.logo,
    required this.stadiumLevel,
    required this.managerId,
    required this.squad,
    required this.chemistryScore,
    required this.isAI,
    required this.wins,
    required this.draws,
    required this.losses,
    required this.points,
    required this.goalsFor,
    required this.goalsAgainst,
  });

  factory Club.fromJson(Map<String, dynamic> j) => Club(
        id: (j['id'] ?? '') as String,
        name: (j['name'] ?? '') as String,
        logo: (j['logo'] ?? 'default') as String,
        stadiumLevel: (j['stadiumLevel'] ?? 1) as int,
        managerId: (j['managerId'] ?? '') as String,
        squad: ((j['squad'] as List?) ?? const [])
            .map((e) => e.toString())
            .toList(),
        chemistryScore: (j['chemistryScore'] ?? 0) as int,
        isAI: (j['isAI'] ?? false) as bool,
        wins: (j['wins'] ?? 0) as int,
        draws: (j['draws'] ?? 0) as int,
        losses: (j['losses'] ?? 0) as int,
        points: (j['points'] ?? 0) as int,
        goalsFor: (j['goalsFor'] ?? 0) as int,
        goalsAgainst: (j['goalsAgainst'] ?? 0) as int,
      );
}

class Attributes {
  final int speed, strength, stamina, passing, ballControl, finishing;
  final int tackling, positioning, tacticalIQ;
  final int reflexes, handling, diving, kicking, gkPositioning;

  Attributes({
    this.speed = 0,
    this.strength = 0,
    this.stamina = 0,
    this.passing = 0,
    this.ballControl = 0,
    this.finishing = 0,
    this.tackling = 0,
    this.positioning = 0,
    this.tacticalIQ = 0,
    this.reflexes = 0,
    this.handling = 0,
    this.diving = 0,
    this.kicking = 0,
    this.gkPositioning = 0,
  });

  factory Attributes.fromJson(Map<String, dynamic> j) => Attributes(
        speed: (j['speed'] ?? 0) as int,
        strength: (j['strength'] ?? 0) as int,
        stamina: (j['stamina'] ?? 0) as int,
        passing: (j['passing'] ?? 0) as int,
        ballControl: (j['ballControl'] ?? 0) as int,
        finishing: (j['finishing'] ?? 0) as int,
        tackling: (j['tackling'] ?? 0) as int,
        positioning: (j['positioning'] ?? 0) as int,
        tacticalIQ: (j['tacticalIQ'] ?? 0) as int,
        reflexes: (j['reflexes'] ?? 0) as int,
        handling: (j['handling'] ?? 0) as int,
        diving: (j['diving'] ?? 0) as int,
        kicking: (j['kicking'] ?? 0) as int,
        gkPositioning: (j['gkPositioning'] ?? 0) as int,
      );
}

class Player {
  final String id;
  final String name;
  final String nationality;
  final int age;
  final String position; // GK|DEF|MID|ATT
  final String rarity;   // common|rare|epic|legendary|special
  final int overallRating;
  final Attributes attributes;
  final bool onMarket;

  Player({
    required this.id,
    required this.name,
    required this.nationality,
    required this.age,
    required this.position,
    required this.rarity,
    required this.overallRating,
    required this.attributes,
    required this.onMarket,
  });

  factory Player.fromJson(Map<String, dynamic> j) => Player(
        id: (j['id'] ?? '') as String,
        name: (j['name'] ?? '') as String,
        nationality: (j['nationality'] ?? '') as String,
        age: (j['age'] ?? 0) as int,
        position: (j['position'] ?? 'MID') as String,
        rarity: (j['rarity'] ?? 'common') as String,
        overallRating: (j['overallRating'] ?? 0) as int,
        attributes: j['attributes'] is Map<String, dynamic>
            ? Attributes.fromJson(j['attributes'] as Map<String, dynamic>)
            : Attributes(),
        onMarket: (j['onMarket'] ?? false) as bool,
      );
}

class CoachBonuses {
  final int tacticalBoost;
  final int staminaBoost;
  final int chemistryBoost;
  CoachBonuses({
    required this.tacticalBoost,
    required this.staminaBoost,
    required this.chemistryBoost,
  });
  factory CoachBonuses.fromJson(Map<String, dynamic> j) => CoachBonuses(
        tacticalBoost: (j['tacticalBoost'] ?? 0) as int,
        staminaBoost: (j['staminaBoost'] ?? 0) as int,
        chemistryBoost: (j['chemistryBoost'] ?? 0) as int,
      );
}

class Coach {
  final String id;
  final String name;
  final String nationality;
  final String rarity;
  final CoachBonuses bonuses;
  Coach({
    required this.id,
    required this.name,
    required this.nationality,
    required this.rarity,
    required this.bonuses,
  });
  factory Coach.fromJson(Map<String, dynamic> j) => Coach(
        id: (j['id'] ?? '') as String,
        name: (j['name'] ?? '') as String,
        nationality: (j['nationality'] ?? '') as String,
        rarity: (j['rarity'] ?? 'common') as String,
        bonuses: j['bonuses'] is Map<String, dynamic>
            ? CoachBonuses.fromJson(j['bonuses'] as Map<String, dynamic>)
            : CoachBonuses(tacticalBoost: 0, staminaBoost: 0, chemistryBoost: 0),
      );
}

class ChemistryResult {
  final String majorityNation;
  final int majoritySize;
  final int baseBonus;
  final int coachBonus;
  final int totalBonus;
  ChemistryResult({
    required this.majorityNation,
    required this.majoritySize,
    required this.baseBonus,
    required this.coachBonus,
    required this.totalBonus,
  });
  factory ChemistryResult.fromJson(Map<String, dynamic> j) => ChemistryResult(
        majorityNation: (j['majorityNation'] ?? '') as String,
        majoritySize: (j['majoritySize'] ?? 0) as int,
        baseBonus: (j['baseBonus'] ?? 0) as int,
        coachBonus: (j['coachBonus'] ?? 0) as int,
        totalBonus: (j['totalBonus'] ?? 0) as int,
      );
}

class SquadResponse {
  final Club club;
  final List<Player> players;
  final Coach? coach;
  final ChemistryResult chemistry;
  SquadResponse({
    required this.club,
    required this.players,
    required this.coach,
    required this.chemistry,
  });
  factory SquadResponse.fromJson(Map<String, dynamic> j) => SquadResponse(
        club: Club.fromJson(j['club'] as Map<String, dynamic>),
        players: ((j['players'] as List?) ?? const [])
            .map((e) => Player.fromJson(e as Map<String, dynamic>))
            .toList(),
        coach: j['coach'] is Map<String, dynamic>
            ? Coach.fromJson(j['coach'] as Map<String, dynamic>)
            : null,
        chemistry: j['chemistry'] is Map<String, dynamic>
            ? ChemistryResult.fromJson(j['chemistry'] as Map<String, dynamic>)
            : ChemistryResult(
                majorityNation: '',
                majoritySize: 0,
                baseBonus: 0,
                coachBonus: 0,
                totalBonus: 0,
              ),
      );
}

class MatchStats {
  final int shots, onTarget, possession, chances;
  MatchStats({
    required this.shots,
    required this.onTarget,
    required this.possession,
    required this.chances,
  });
  factory MatchStats.fromJson(Map<String, dynamic> j) => MatchStats(
        shots: (j['shots'] ?? 0) as int,
        onTarget: (j['onTarget'] ?? 0) as int,
        possession: (j['possession'] ?? 0) as int,
        chances: (j['chances'] ?? 0) as int,
      );
}

class MatchEvent {
  final int minute;
  final String team; // home|away
  final String type; // goal|save|shot
  final String note;
  MatchEvent({
    required this.minute,
    required this.team,
    required this.type,
    required this.note,
  });
  factory MatchEvent.fromJson(Map<String, dynamic> j) => MatchEvent(
        minute: (j['minute'] ?? 0) as int,
        team: (j['team'] ?? '') as String,
        type: (j['type'] ?? '') as String,
        note: (j['note'] ?? '') as String,
      );
}

class MatchResult {
  final String id;
  final String homeClubId, awayClubId, homeName, awayName;
  final int homeGoals, awayGoals;
  final MatchStats homeStats, awayStats;
  final List<MatchEvent> events;
  final String mode;
  final int reward;
  final DateTime playedAt;

  MatchResult({
    required this.id,
    required this.homeClubId,
    required this.awayClubId,
    required this.homeName,
    required this.awayName,
    required this.homeGoals,
    required this.awayGoals,
    required this.homeStats,
    required this.awayStats,
    required this.events,
    required this.mode,
    required this.reward,
    required this.playedAt,
  });
  factory MatchResult.fromJson(Map<String, dynamic> j) => MatchResult(
        id: (j['id'] ?? '') as String,
        homeClubId: (j['homeClubId'] ?? '') as String,
        awayClubId: (j['awayClubId'] ?? '') as String,
        homeName: (j['homeName'] ?? '') as String,
        awayName: (j['awayName'] ?? '') as String,
        homeGoals: (j['homeGoals'] ?? 0) as int,
        awayGoals: (j['awayGoals'] ?? 0) as int,
        homeStats: MatchStats.fromJson(
            (j['homeStats'] as Map<String, dynamic>? ?? const {})),
        awayStats: MatchStats.fromJson(
            (j['awayStats'] as Map<String, dynamic>? ?? const {})),
        events: ((j['events'] as List?) ?? const [])
            .map((e) => MatchEvent.fromJson(e as Map<String, dynamic>))
            .toList(),
        mode: (j['mode'] ?? 'quick') as String,
        reward: (j['reward'] ?? 0) as int,
        playedAt: DateTime.tryParse((j['playedAt'] ?? '') as String) ??
            DateTime.now(),
      );
}

class StandingRow {
  final String clubId, name;
  final int played, wins, draws, losses, goalsFor, goalsAgainst, goalDiff, points;
  final bool isAI;
  StandingRow({
    required this.clubId,
    required this.name,
    required this.played,
    required this.wins,
    required this.draws,
    required this.losses,
    required this.goalsFor,
    required this.goalsAgainst,
    required this.goalDiff,
    required this.points,
    required this.isAI,
  });
  factory StandingRow.fromJson(Map<String, dynamic> j) => StandingRow(
        clubId: (j['clubId'] ?? '') as String,
        name: (j['name'] ?? '') as String,
        played: (j['played'] ?? 0) as int,
        wins: (j['wins'] ?? 0) as int,
        draws: (j['draws'] ?? 0) as int,
        losses: (j['losses'] ?? 0) as int,
        goalsFor: (j['goalsFor'] ?? 0) as int,
        goalsAgainst: (j['goalsAgainst'] ?? 0) as int,
        goalDiff: (j['goalDiff'] ?? 0) as int,
        points: (j['points'] ?? 0) as int,
        isAI: (j['isAI'] ?? false) as bool,
      );
}

class Mission {
  final String id, description, period;
  final int goal, progress, reward;
  final bool completed, claimed;
  Mission({
    required this.id,
    required this.description,
    required this.period,
    required this.goal,
    required this.progress,
    required this.reward,
    required this.completed,
    required this.claimed,
  });
  factory Mission.fromJson(Map<String, dynamic> j) => Mission(
        id: (j['id'] ?? '') as String,
        description: (j['description'] ?? '') as String,
        period: (j['period'] ?? 'daily') as String,
        goal: (j['goal'] ?? 1) as int,
        progress: (j['progress'] ?? 0) as int,
        reward: (j['reward'] ?? 0) as int,
        completed: (j['completed'] ?? false) as bool,
        claimed: (j['claimed'] ?? false) as bool,
      );
}

class Pack {
  final String id, name, tier;
  final int priceSoft, pricePremium, playerCount, coachChance;
  Pack({
    required this.id,
    required this.name,
    required this.tier,
    required this.priceSoft,
    required this.pricePremium,
    required this.playerCount,
    required this.coachChance,
  });
  factory Pack.fromJson(Map<String, dynamic> j) => Pack(
        id: (j['id'] ?? '') as String,
        name: (j['name'] ?? '') as String,
        tier: (j['tier'] ?? 'basic') as String,
        priceSoft: (j['priceSoft'] ?? 0) as int,
        pricePremium: (j['pricePremium'] ?? 0) as int,
        playerCount: (j['playerCount'] ?? 0) as int,
        coachChance: (j['coachChance'] ?? 0) as int,
      );
}

class PackOpenResult {
  final Pack pack;
  final List<Player> players;
  final Coach? coach;
  PackOpenResult({required this.pack, required this.players, required this.coach});
  factory PackOpenResult.fromJson(Map<String, dynamic> j) => PackOpenResult(
        pack: Pack.fromJson(j['pack'] as Map<String, dynamic>),
        players: ((j['players'] as List?) ?? const [])
            .map((e) => Player.fromJson(e as Map<String, dynamic>))
            .toList(),
        coach: j['coach'] is Map<String, dynamic>
            ? Coach.fromJson(j['coach'] as Map<String, dynamic>)
            : null,
      );
}

class Listing {
  final String listingId, playerId, sellerId;
  final int price;
  final Player? player;
  Listing({
    required this.listingId,
    required this.playerId,
    required this.sellerId,
    required this.price,
    required this.player,
  });
  factory Listing.fromJson(Map<String, dynamic> j) => Listing(
        listingId: (j['listingId'] ?? '') as String,
        playerId: (j['playerId'] ?? '') as String,
        sellerId: (j['sellerId'] ?? '') as String,
        price: (j['price'] ?? 0) as int,
        player: j['player'] is Map<String, dynamic>
            ? Player.fromJson(j['player'] as Map<String, dynamic>)
            : null,
      );
}

class AuthResponse {
  final String token;
  final User user;
  final Club club;
  AuthResponse({required this.token, required this.user, required this.club});
  factory AuthResponse.fromJson(Map<String, dynamic> j) => AuthResponse(
        token: (j['token'] ?? '') as String,
        user: User.fromJson(j['user'] as Map<String, dynamic>),
        club: Club.fromJson(j['club'] as Map<String, dynamic>),
      );
}
