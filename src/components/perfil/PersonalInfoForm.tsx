import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { UserRoundPen, Loader2, LocateFixed } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ChangePasswordDialog from './ChangePasswordDialog';

interface PersonalInfoFormProps {
  initialData: {
    name: string;
    email: string;
    phone: string;
    state: string;
    city: string;
  };
}

interface State {
  id: number;
  sigla: string;
  nome: string;
}

interface City {
  id: number;
  nome: string;
}

export default function PersonalInfoForm({ initialData }: PersonalInfoFormProps) {
  const [formData, setFormData] = useState(initialData);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);

  const handleGetLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Seu navegador não suporta geolocalização');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`
          );
          const geo = await res.json();
          const stateName = geo?.address?.state || '';
          const cityName = geo?.address?.city || geo?.address?.town || geo?.address?.municipality || '';
          
          // Match state name to sigla
          const matchedState = states.find(s => 
            s.nome.toLowerCase() === stateName.toLowerCase()
          );
          
          if (matchedState) {
            setFormData(prev => ({ ...prev, state: matchedState.sigla, city: '' }));
            // After state is set, cities will load via useEffect, then set city
            if (cityName) {
              // Wait for cities to load then set city
              const citiesRes = await fetch(
                `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${matchedState.sigla}/municipios`
              );
              const citiesData: City[] = await citiesRes.json();
              setCities(citiesData);
              const matchedCity = citiesData.find(c => 
                c.nome.toLowerCase() === cityName.toLowerCase()
              );
              if (matchedCity) {
                setFormData(prev => ({ ...prev, city: matchedCity.nome }));
              }
            }
            toast.success(`Localização detectada: ${matchedState.nome}${cityName ? `, ${cityName}` : ''}`);
          } else if (stateName) {
            toast.error(`Estado "${stateName}" não encontrado na lista`);
          } else {
            toast.error('Não foi possível detectar a localização');
          }
        } catch {
          toast.error('Erro ao detectar localização');
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        toast.error('Permissão de localização negada');
        setIsLocating(false);
      },
      { timeout: 10000 }
    );
  };

  // Update formData when initialData changes
  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;
    
    if (cleaned.length >= 1) {
      formatted = `(${cleaned.substring(0, 2)}`;
    }
    if (cleaned.length >= 3) {
      formatted += `) ${cleaned.substring(2, 7)}`;
    }
    if (cleaned.length >= 8) {
      formatted += `-${cleaned.substring(7, 11)}`;
    }
    
    return formatted;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    setFormData(prev => ({ ...prev, phone: formatted }));
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(res => res.json())
      .then((data: State[]) => {
        setStates(data);
        setLoadingStates(false);
      })
      .catch(() => {
        // Falha silenciosa - não atrapalha o uso do formulário
        setLoadingStates(false);
      });
  }, []);

  useEffect(() => {
    if (formData.state) {
      setLoadingCities(true);
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${formData.state}/municipios`)
        .then(res => res.json())
        .then((data: City[]) => {
          setCities(data);
          setLoadingCities(false);
        })
        .catch(() => {
          // Falha silenciosa - não atrapalha o uso do formulário
          setLoadingCities(false);
        });
    }
  }, [formData.state]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          phone: formData.phone,
          state: formData.state,
          city: formData.city,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Informações atualizadas com sucesso!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erro ao salvar informações. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  // Prepare state options
  const stateOptions = states.map(state => ({
    value: state.sigla,
    label: state.nome
  }));

  // Prepare city options
  const cityOptions = cities.map(city => ({
    value: city.nome,
    label: city.nome
  }));

  return (
    <>
      <Card className="h-full group shadow-lg hover:shadow-xl transition-all duration-300 border-0 bg-card overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        
        <CardHeader className="relative bg-gradient-to-r from-primary/8 via-secondary/5 to-accent/8 border-b border-primary/10 p-3 sm:p-5 md:p-6">
          <div className="flex items-center gap-3">
            <div className="relative p-2 sm:p-2.5 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-300">
              <UserRoundPen className="h-5 w-5 sm:h-6 sm:w-6 text-primary relative z-10" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent truncate">
                Dados Pessoais
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs sm:text-sm">
                Atualize suas informações de contato e localização
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 sm:space-y-5 md:space-y-6 p-3 sm:p-5 md:px-8 md:py-6 relative">
          {/* Nome Completo */}
          <div className="space-y-1.5 sm:space-y-2 group/field">
            <Label htmlFor="name" className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2 group-hover/field:text-primary transition-colors">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gradient-to-r from-primary to-secondary rounded-full shadow-sm group-hover/field:shadow-md group-hover/field:scale-125 transition-all duration-300" />
              Nome Completo
            </Label>
            <div className="relative">
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => handleChange('name', e.target.value)} 
                className="h-10 sm:h-11 border-2 border-primary/20 focus:border-primary/50 hover:border-primary/30 rounded-xl bg-background/80 backdrop-blur-sm transition-all duration-300 text-sm sm:text-base shadow-sm focus:shadow-md pl-3 sm:pl-4"
              />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
          </div>

          {/* Email e Telefone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div className="space-y-1.5 sm:space-y-2 group/field">
              <Label htmlFor="email" className="text-xs sm:text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-muted rounded-full" />
                Email
              </Label>
              <div className="relative pb-4 sm:pb-5">
                <Input 
                  id="email"
                  type="email" 
                  value={formData.email || ''} 
                  disabled 
                  className="h-10 sm:h-11 cursor-not-allowed bg-muted/30 border-2 border-muted/40 rounded-xl text-sm sm:text-base pl-3 sm:pl-4 shadow-sm"
                />
                <p className="absolute bottom-0 left-0 text-[10px] sm:text-xs text-muted-foreground/80 italic">
                  Campo protegido por segurança
                </p>
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2 group/field">
              <Label htmlFor="phone" className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2 group-hover/field:text-accent transition-colors">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gradient-to-r from-accent to-primary rounded-full shadow-sm group-hover/field:shadow-md group-hover/field:scale-125 transition-all duration-300" />
                Telefone
              </Label>
              <div className="relative">
                <Input 
                  id="phone" 
                  value={formData.phone || ''} 
                  onChange={(e) => handlePhoneChange(e.target.value)} 
                  className="h-10 sm:h-11 border-2 border-accent/20 focus:border-accent/50 hover:border-accent/30 rounded-xl bg-background/80 backdrop-blur-sm transition-all duration-300 text-sm sm:text-base shadow-sm focus:shadow-md pl-3 sm:pl-4"
                  placeholder="(XX) XXXXX-XXXX"
                  maxLength={15}
                />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent/5 to-primary/5 opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
            </div>
          </div>
          
          {/* Estado e Cidade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div className="space-y-1.5 sm:space-y-2 group/field">
              <Label htmlFor="state" className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2 group-hover/field:text-secondary transition-colors duration-300">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gradient-to-r from-secondary to-accent rounded-full shadow-sm group-hover/field:shadow-md group-hover/field:shadow-secondary/50 group-hover/field:scale-125 transition-all duration-300" />
                Estado
              </Label>
              <div className="relative group/select">
                <NativeSelect
                  value={formData.state || ''}
                  onValueChange={(value) => {
                    handleChange('state', value);
                    handleChange('city', '');
                  }}
                  disabled={loadingStates}
                  options={stateOptions}
                  placeholder={loadingStates ? 'Carregando...' : 'Selecione um estado'}
                  triggerClassName="h-10 sm:h-11 border-2 border-secondary/20 focus:border-secondary/50 hover:border-secondary/40 hover:shadow-lg hover:shadow-secondary/20 rounded-xl bg-background/80 backdrop-blur-sm text-sm sm:text-base shadow-sm focus:shadow-md transition-all duration-300"
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2 group/field">
              <Label htmlFor="city" className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2 group-hover/field:text-secondary transition-colors duration-300">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gradient-to-r from-secondary to-primary rounded-full shadow-sm group-hover/field:shadow-md group-hover/field:shadow-secondary/50 group-hover/field:scale-125 transition-all duration-300" />
                Cidade
              </Label>
              <div className="relative group/select">
                <NativeSelect
                  value={formData.city || ''}
                  onValueChange={(value) => handleChange('city', value)}
                  disabled={!formData.state || loadingCities}
                  options={cityOptions}
                  placeholder={loadingCities ? 'Carregando...' : 'Selecione uma cidade'}
                  triggerClassName="h-10 sm:h-11 border-2 border-secondary/20 focus:border-secondary/50 hover:border-secondary/40 hover:shadow-lg hover:shadow-secondary/20 rounded-xl bg-background/80 backdrop-blur-sm text-sm sm:text-base shadow-sm focus:shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
          
          {/* Botões de Ação */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 sm:pt-5 border-t border-primary/10">
            <Button 
              variant="outline" 
              onClick={() => setIsPasswordDialogOpen(true)} 
              className="w-full sm:w-auto h-10 sm:h-11 rounded-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              Alterar Senha
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving} 
              className="w-full sm:w-auto flex-1 h-10 sm:h-11 rounded-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ChangePasswordDialog
        isOpen={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
      />
    </>
  );
}
