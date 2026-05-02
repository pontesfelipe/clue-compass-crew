import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Search } from "lucide-react";
import { Helmet } from "react-helmet";
import { useState, useMemo } from "react";

export default function MembersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [chamberFilter, setChamberFilter] = useState<string>("all");
  const [partyFilter, setPartyFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("federal");

  const { data: members, isLoading } = useQuery({
    queryKey: ["all-members", levelFilter],
    queryFn: async () => {
      let query = supabase
        .from("members")
        .select("id, full_name, first_name, last_name, party, state, chamber, district, level")
        .eq("in_office", true)
        .order("last_name", { ascending: true });

      if (levelFilter !== "all") {
        query = query.eq("level", levelFilter as "federal" | "state");
      }

      // State legislators can be ~7000+ rows — raise the cap above the default 1000
      query = query.limit(10000);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    const term = searchTerm.toLowerCase();
    return members.filter((m) => {
      if (chamberFilter !== "all" && m.chamber !== chamberFilter) return false;
      if (partyFilter !== "all" && m.party !== partyFilter) return false;
      if (!term) return true;
      return (
        m.full_name.toLowerCase().includes(term) ||
        m.state.toLowerCase().includes(term) ||
        m.party.toLowerCase().includes(term)
      );
    });
  }, [members, searchTerm, chamberFilter, partyFilter]);

  // Group members by first letter of last name
  const groupedMembers = useMemo(() => {
    const groups: Record<string, typeof filteredMembers> = {};
    filteredMembers.forEach((m) => {
      const letter = m.last_name.charAt(0).toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(m);
    });
    return groups;
  }, [filteredMembers]);

  const letters = Object.keys(groupedMembers).sort();

  const partyColor = (party: string) => {
    switch (party) {
      case "D":
        return "bg-blue-500/10 text-blue-600 border-blue-500/30";
      case "R":
        return "bg-red-500/10 text-red-600 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <>
      <Helmet>
        <title>All Legislators | CivicScore</title>
        <meta
          name="description"
          content="Browse all current U.S. federal and state legislators — Senators, Representatives, and state House and Senate members."
        />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 civic-container py-8">
          <div className="flex items-center gap-3 mb-6">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="font-serif text-3xl font-bold">
              {levelFilter === "state"
                ? "State Legislators"
                : levelFilter === "federal"
                ? "Members of Congress"
                : "All Legislators"}
            </h1>
          </div>

          <p className="text-muted-foreground mb-6">
            {isLoading
              ? "Loading..."
              : `${members?.length || 0} current ${
                  levelFilter === "state" ? "state legislators" : levelFilter === "federal" ? "members of Congress" : "legislators"
                } sorted alphabetically by last name`}
          </p>

          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, state, or party..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="federal">Federal</SelectItem>
                <SelectItem value="state">State</SelectItem>
                <SelectItem value="all">All Levels</SelectItem>
              </SelectContent>
            </Select>
            <Select value={chamberFilter} onValueChange={setChamberFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Chamber" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Chambers</SelectItem>
                <SelectItem value="house">House</SelectItem>
                <SelectItem value="senate">Senate</SelectItem>
              </SelectContent>
            </Select>
            <Select value={partyFilter} onValueChange={setPartyFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Party" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Parties</SelectItem>
                <SelectItem value="D">Democratic</SelectItem>
                <SelectItem value="R">Republican</SelectItem>
                <SelectItem value="I">Independent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {letters.map((letter) => (
                <div key={letter}>
                  <h2 className="font-serif text-2xl font-bold mb-4 text-primary border-b pb-2">
                    {letter}
                  </h2>
                  <div className="grid gap-2">
                    {groupedMembers[letter].map((member) => (
                      <Link
                        key={member.id}
                        to={`/member/${member.id}`}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium">
                            {member.last_name}, {member.first_name}
                          </span>
                          <Badge variant="outline" className={partyColor(member.party)}>
                            {member.party}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{member.state}</span>
                          <Badge variant="secondary">
                            {member.chamber === "senate" ? "Senator" : `District ${member.district}`}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              {filteredMembers.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No members found matching "{searchTerm}"
                </p>
              )}
            </div>
          )}
        </main>

        <Footer />
      </div>
    </>
  );
}
