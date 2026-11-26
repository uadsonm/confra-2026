-- ATUALIZAÇÃO: votos reais, que só o admin enxerga.
-- Rode este arquivo UMA vez no Supabase: SQL Editor > New query > colar > Run.
-- (Não tem senha aqui dentro: ele usa a senha que já está cadastrada.)

-- Um voto por celular, por categoria, por rodada. Votar de novo só troca o voto.
create table if not exists public.voto (
  rodada    int  not null,
  categoria text not null,
  aparelho  text not null,
  escolhido text not null,
  criado_em timestamptz not null default now(),
  primary key (rodada, categoria, aparelho)
);
alter table public.voto enable row level security;
-- Sem nenhuma policy: ninguém de fora lê nem grava direto na tabela.
revoke all on public.voto from anon, authenticated;

-- Público: registra o voto. Se o celular ainda estiver numa rodada antiga
-- (o admin zerou e ele não percebeu), o voto é ignorado.
create or replace function public.votar(p_rodada int, p_aparelho text, p_categoria text, p_escolhido text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare atual int;
begin
  select rodada into atual from controle where id = 1;
  if p_rodada is not null and p_rodada <> atual then
    return false;
  end if;
  if length(coalesce(p_aparelho, '')) not between 8 and 64
     or length(coalesce(p_categoria, '')) not between 1 and 40
     or length(coalesce(p_escolhido, '')) not between 1 and 60 then
    raise exception 'voto invalido';
  end if;
  insert into voto (rodada, categoria, aparelho, escolhido)
  values (atual, p_categoria, p_aparelho, p_escolhido)
  on conflict (rodada, categoria, aparelho)
  do update set escolhido = excluded.escolhido, criado_em = now();
  return true;
end $$;
grant execute on function public.votar(int, text, text, text) to anon;

-- Admin: apuração da rodada atual (quantos celulares votaram e votos por pessoa).
create or replace function public.admin_votos(p_senha text)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admin_senha where senha = p_senha) then
    raise exception 'senha invalida';
  end if;
  return json_build_object(
    'celulares', (
      select count(distinct v.aparelho)
      from voto v join controle c on c.id = 1 and v.rodada = c.rodada
    ),
    'votos', coalesce((
      select json_agg(t) from (
        select v.categoria, v.escolhido, count(*)::int as votos
        from voto v join controle c on c.id = 1 and v.rodada = c.rodada
        group by v.categoria, v.escolhido
        order by v.categoria, count(*) desc, v.escolhido
      ) t
    ), '[]'::json)
  );
end $$;
grant execute on function public.admin_votos(text) to anon;
