import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Users, Search } from "lucide-react";
import { Helmet } from "react-helmet";
import { useState, useMemo } from "react";

export default function MembersPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: members, isLoading } = useQuery({
    queryKey: ["all-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, full_name, first_name, last_name, party, state, chamber, district")
        .eq("in_office", true)
        .order("last_name", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    if (!searchTerm) return members;
    const term = searchTerm.toLowerCase();
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(term) ||
        m.state.toLowerCase().includes(term) ||
        m.party.toLowerCase().includes(term)
    );
  }, [members, searchTerm]);

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
        <title>All Members of Congress | CivicScore</title>
        <meta
          name="description"
          content="Browse all current members of the U.S. Congress, including Senators and Representatives, sorted alphabetically."
        />
      </Helmet>

      <div className="min-h-screen flex flex-col bg-background">
        <Header />

        <main className="flex-1 civic-container py-8">
          <div className="flex items-center gap-3 mb-6">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="font-serif text-3xl font-bold">All Members of Congress</h1>
          </div>

          <p className="text-muted-foreground mb-6">
            {isLoading
              ? "Loading..."
              : `${members?.length || 0} current members sorted alphabetically by last name`}
          </p>

          <div className="relative mb-8 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, state, or party..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
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
