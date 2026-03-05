import Runtime "mo:core/Runtime";

actor {
  var highScore = 0;

  public shared ({ caller }) func submitScore(score : Nat) : async () {
    if (score <= highScore) { Runtime.trap("Score must be higher than current high score.") };
    highScore := score;
  };

  public query ({ caller }) func getHighScore() : async Nat {
    highScore;
  };
};
