import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { stateNames } from "@/hooks/useStateData";
import { AGE_RANGES } from "../../types";

interface BasicInfoStepProps {
  data: {
    state: string;
    zip_code: string;
    age_range: string;
  };
  onUpdate: (data: Partial<{ state: string; zip_code: string; age_range: string }>) => void;
}

export function BasicInfoStep({ data, onUpdate }: BasicInfoStepProps) {
  const stateOptions = Object.entries(stateNames).map(([abbr, name]) => ({
    value: abbr,
    label: name,
  }));
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold text-foreground mb-2">
          Let's start with some basics
        </h2>
        <p className="text-muted-foreground">
          This helps us show you relevant representatives. We never store or ask about party affiliation.
        </p>
      </div>
      
      <div className="space-y-4 max-w-md">
        <div className="space-y-2">
          <Label htmlFor="state">
            Your State <span className="text-destructive">*</span>
          </Label>
          <Select
            value={data.state}
            onValueChange={(value) => onUpdate({ state: value })}
          >
            <SelectTrigger id="state">
              <SelectValue placeholder="Select your state" />
            </SelectTrigger>
            <SelectContent>
              {stateOptions.map((state) => (
                <SelectItem key={state.value} value={state.value}>
                  {state.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Required to show your senators and representative
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="zip">Zip Code (optional)</Label>
          <Input
            id="zip"
            type="text"
            placeholder="12345"
            value={data.zip_code}
            onChange={(e) => onUpdate({ zip_code: e.target.value })}
            maxLength={10}
          />
          <p className="text-xs text-muted-foreground">
            Helps identify your specific congressional district
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="age">Age Range (optional)</Label>
          <Select
            value={data.age_range}
            onValueChange={(value) => onUpdate({ age_range: value })}
          >
            <SelectTrigger id="age">
              <SelectValue placeholder="Select age range" />
            </SelectTrigger>
            <SelectContent>
              {AGE_RANGES.map((range) => (
                <SelectItem key={range} value={range}>
                  {range}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
