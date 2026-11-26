-- ATUALIZAÇÃO: botão "Zerar votação" do admin.
-- Rode este arquivo UMA vez no Supabase: SQL Editor > New query > colar > Run.
-- (Não tem senha aqui dentro: ele usa a senha que já está cadastrada.)

-- Número da rodada. Quando o admin zera, ele aumenta e todo celular
-- percebe a mudança, apaga os votos locais e volta para a roleta.
create table if not exists public.controle (
  id     int primary key default 1 check (id = 1),
  rodada int not null default 1
);
insert into public.controle (id, rodada) values (1, 1) on conflict (id) do nothing;
alter table public.controle enable row level security;
drop policy if exists "publico le controle" on public.controle;
create policy "publico le controle" on public.controle for select to anon using (true);
grant select on public.controle to anon;

-- Zera: esconde todas as categorias reveladas (os vencedores escolhidos
-- continuam salvos) e avança a rodada.
create or replace function public.admin_resetar(p_senha text)
returns int
language plpgsql security definer set search_path = public as $$
declare nova int;
begin
  if not exists (select 1 from admin_senha where senha = p_senha) then
    raise exception 'senha invalida';
  end if;
  update resultado set revelado = false, revelado_em = null where revelado;
  update controle set rodada = rodada + 1 where id = 1 returning rodada into nova;
  return nova;
end $$;

grant execute on function public.admin_resetar(text) to anon;
