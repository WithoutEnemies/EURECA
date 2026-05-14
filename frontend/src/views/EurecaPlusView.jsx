import { useState } from "react";
import {
  CalendarClock,
  Check,
  CreditCard,
  Crown,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";

const plusPlans = [
  {
    id: "monthly",
    name: "Mensal",
    price: "10,99 €",
    period: "/ mês",
    note: "Flexível para experimentar sem compromisso longo.",
    cta: "Escolher mensal",
    summary: "Cobrança mensal de 10,99 €.",
    badge: "Entrada",
  },
  {
    id: "quarterly",
    name: "Trimestral",
    price: "27,99 €",
    period: "/ 3 meses",
    note: "Mais tempo para crescer com economia no período.",
    cta: "Escolher trimestral",
    summary: "Cobrança a cada 3 meses de 27,99 €.",
    badge: "Equilíbrio",
  },
  {
    id: "annual",
    name: "Anual",
    price: "89,99 €",
    period: "/ ano",
    note: "Maior desconto para quem quer manter o EURECA+ ativo.",
    cta: "Escolher anual",
    summary: "Cobrança anual de 89,99 €.",
    badge: "Melhor valor",
    featured: true,
  },
];

const paymentMethods = [
  {
    id: "card",
    label: "Cartão",
    detail: "Visa, Mastercard ou cartão virtual",
    icon: CreditCard,
  },
  {
    id: "mbway",
    label: "MB WAY",
    detail: "Pagamento por número de telemóvel",
    icon: Smartphone,
  },
  {
    id: "paypal",
    label: "PayPal",
    detail: "Entrar e aprovar no PayPal",
    icon: Wallet,
  },
];

const plusBenefits = [
  "Selo EURECA+ no perfil e nas conversas",
  "Mais destaque para posts e ideias em alta",
  "Analytics do perfil com alcance, views e interações",
  "Limites ampliados para publicar com mídia",
];

function formatPlusDate(value) {
  if (!value) return "Ativo";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ativo";

  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getPlanById(planId) {
  return plusPlans.find((plan) => plan.id === planId) ?? plusPlans[0];
}

function getNextBillingDate(value, planId) {
  const startedAt = value ? new Date(value) : new Date();
  if (Number.isNaN(startedAt.getTime())) return "A definir";

  const nextDate = new Date(startedAt);
  if (planId === "annual") nextDate.setFullYear(nextDate.getFullYear() + 1);
  else if (planId === "quarterly") nextDate.setMonth(nextDate.getMonth() + 3);
  else nextDate.setMonth(nextDate.getMonth() + 1);

  return formatPlusDate(nextDate);
}

function EurecaPlusView({
  me,
  sessionName,
  token,
  onMembershipActivated,
  onMembershipCancelled,
}) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("card");
  const [checkoutNotice, setCheckoutNotice] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [manageNotice, setManageNotice] = useState("");
  const [manageLoadingAction, setManageLoadingAction] = useState("");
  const [paymentPanelOpen, setPaymentPanelOpen] = useState(false);

  const hasMembership = Boolean(me?.eurecaPlusSince);
  const activePlan = getPlanById(me?.eurecaPlusPlan);
  const selectedPayment =
    paymentMethods.find((method) => method.id === selectedPaymentMethod) ??
    paymentMethods[0];
  const SelectedPaymentIcon = selectedPayment.icon;

  const openCheckout = (plan) => {
    setSelectedPlan(plan);
    setSelectedPaymentMethod("card");
    setCheckoutNotice("");
    setManageNotice("");
  };

  const closeCheckout = () => {
    setSelectedPlan(null);
    setCheckoutNotice("");
    setCheckoutLoading(false);
  };

  const confirmCheckout = async () => {
    if (!selectedPlan || checkoutLoading) return;

    setCheckoutLoading(true);
    setCheckoutNotice("");

    try {
      const result = await onMembershipActivated?.(selectedPlan.id, token);
      if (result?.ok === false) {
        const message = Array.isArray(result.data?.message)
          ? result.data.message.join(" ")
          : result.data?.message;
        setCheckoutNotice(message ?? "Não foi possível ativar o EURECA+.");
        return;
      }

      setCheckoutNotice(
        `Pagamento ${selectedPayment.label} confirmado. Ranking EURECA+ atualizado.`,
      );
      setSelectedPlan(null);
    } catch {
      setCheckoutNotice("Backend indisponível. Não foi possível ativar o plano.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const changePlan = async (plan) => {
    if (manageLoadingAction || plan.id === me?.eurecaPlusPlan) return;

    setManageLoadingAction(`plan-${plan.id}`);
    setManageNotice("");

    try {
      const result = await onMembershipActivated?.(plan.id, token);
      if (result?.ok === false) {
        const message = Array.isArray(result.data?.message)
          ? result.data.message.join(" ")
          : result.data?.message;
        setManageNotice(message ?? "Não foi possível mudar o plano.");
        return;
      }

      setManageNotice(`Plano alterado para ${plan.name}.`);
    } catch {
      setManageNotice("Backend indisponível. Não foi possível mudar o plano.");
    } finally {
      setManageLoadingAction("");
    }
  };

  const cancelMembership = async () => {
    if (manageLoadingAction) return;

    const confirmed = window.confirm(
      "Cancelar a assinatura EURECA+ desta conta?",
    );
    if (!confirmed) return;

    setManageLoadingAction("cancel");
    setManageNotice("");

    try {
      const result = await onMembershipCancelled?.(token);
      if (result?.ok === false) {
        const message = Array.isArray(result.data?.message)
          ? result.data.message.join(" ")
          : result.data?.message;
        setManageNotice(message ?? "Não foi possível cancelar a assinatura.");
        return;
      }

      setManageNotice("Assinatura cancelada.");
    } catch {
      setManageNotice("Backend indisponível. Não foi possível cancelar.");
    } finally {
      setManageLoadingAction("");
    }
  };

  return (
    <>
      <div className="feed-head">
        <h1>EURECA+</h1>
      </div>

      <section className="plus-page">
        <div className="plus-hero panel">
          <div className="plus-hero-copy">
            <span className="plus-kicker">
              <Sparkles aria-hidden="true" />
              Plano premium
            </span>
            <h2>Eleve seu perfil dentro da comunidade.</h2>
            <p>
              EURECA+ libera recursos de presença, descoberta e crescimento
              para quem quer transformar ideias em conversas mais fortes.
            </p>
          </div>
          <div className="plus-pass" aria-label="Cartão EURECA+">
            <div className="plus-pass-top">
              <span className="plus-pass-mark">
                <Crown aria-hidden="true" />
              </span>
              <span className="plus-pass-tier">Plus member</span>
            </div>
            <div className="plus-pass-main">
              <strong>Eureca+</strong>
              <span>{sessionName}</span>
            </div>
            <div className="plus-pass-bottom">
              <span>Premium access</span>
              <span>2026</span>
            </div>
          </div>
        </div>

        {hasMembership ? (
          <div className="plus-content-grid">
            <section className="panel plus-manage-card">
              <div className="plus-section-heading">
                <div>
                  <span>Assinatura</span>
                  <h2>Gerir EURECA+</h2>
                </div>
                <p>Plano ativo para esta conta.</p>
              </div>

              <div className="plus-manage-summary">
                <div>
                  <span className="plus-plan-badge">Ativo</span>
                  <h3>{activePlan.name}</h3>
                  <p>{activePlan.summary}</p>
                </div>
                <div className="plus-manage-stats">
                  <span>
                    <CalendarClock aria-hidden="true" />
                    Desde {formatPlusDate(me?.eurecaPlusSince)}
                  </span>
                  <span>
                    <RefreshCw aria-hidden="true" />
                    Próxima cobrança {getNextBillingDate(
                      me?.eurecaPlusSince,
                      me?.eurecaPlusPlan,
                    )}
                  </span>
                </div>
              </div>

              <div className="plus-manage-actions">
                <button
                  type="button"
                  className="plus-plan-btn"
                  onClick={() => setPaymentPanelOpen((open) => !open)}
                >
                  Alterar método de pagamento
                </button>
                <button
                  type="button"
                  className="plus-danger-btn"
                  onClick={cancelMembership}
                  disabled={manageLoadingAction === "cancel"}
                >
                  {manageLoadingAction === "cancel"
                    ? "Cancelando..."
                    : "Cancelar assinatura"}
                </button>
              </div>

              {paymentPanelOpen ? (
                <div className="plus-payment-list is-management">
                  <span className="plus-payment-label">Método de pagamento</span>
                  {paymentMethods.map((method) => {
                    const MethodIcon = method.icon;

                    return (
                      <button
                        key={method.id}
                        type="button"
                        className={`plus-payment-option ${
                          selectedPaymentMethod === method.id ? "is-selected" : ""
                        }`}
                        aria-pressed={selectedPaymentMethod === method.id}
                        onClick={() => {
                          setSelectedPaymentMethod(method.id);
                          setManageNotice(
                            `${method.label} selecionado. Integração com provedor de pagamento pendente.`,
                          );
                        }}
                      >
                        <MethodIcon aria-hidden="true" />
                        <span>
                          <strong>{method.label}</strong>
                          <small>{method.detail}</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {manageNotice ? (
                <p className="plus-checkout-notice">{manageNotice}</p>
              ) : null}
            </section>

            <section className="plus-plans-section">
              <div className="plus-section-heading">
                <div>
                  <span>Plano</span>
                  <h2>Mudar plano</h2>
                </div>
                <p>Você mantém os benefícios; só muda o ciclo de cobrança.</p>
              </div>

              <div className="plus-plans">
                {plusPlans.map((plan) => {
                  const isCurrentPlan = plan.id === me?.eurecaPlusPlan;

                  return (
                    <article
                      key={plan.id}
                      className={`panel plus-plan-card ${
                        isCurrentPlan || plan.featured ? "is-featured" : ""
                      }`}
                    >
                      <span
                        className={
                          isCurrentPlan ? "plus-plan-badge" : "plus-plan-tag"
                        }
                      >
                        {isCurrentPlan ? "Plano atual" : plan.badge}
                      </span>
                      <div className="plus-plan-head">
                        <h2>{plan.name}</h2>
                        <p>{plan.note}</p>
                      </div>
                      <div className="plus-price-row">
                        <strong>{plan.price}</strong>
                        <span>{plan.period}</span>
                      </div>
                      <button
                        type="button"
                        className="plus-plan-btn"
                        onClick={() => changePlan(plan)}
                        disabled={isCurrentPlan || manageLoadingAction === `plan-${plan.id}`}
                      >
                        {isCurrentPlan
                          ? "Plano ativo"
                          : manageLoadingAction === `plan-${plan.id}`
                            ? "Alterando..."
                            : `Mudar para ${plan.name.toLowerCase()}`}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        ) : (
        <div className="plus-content-grid">
          <section className="plus-plans-section">
            <div className="plus-section-heading">
              <div>
                <span>Planos</span>
                <h2>Escolha como quer desbloquear o EURECA+</h2>
              </div>
              <p>Todos os planos incluem os mesmos benefícios premium.</p>
            </div>

            <div className="plus-plans">
              {plusPlans.map((plan) => (
                <article
                  key={plan.id}
                  className={`panel plus-plan-card ${
                    plan.featured ? "is-featured" : ""
                  }`}
                >
                  <span
                    className={
                      plan.featured ? "plus-plan-badge" : "plus-plan-tag"
                    }
                  >
                    {plan.badge}
                  </span>
                  <div className="plus-plan-head">
                    <h2>{plan.name}</h2>
                    <p>{plan.note}</p>
                  </div>
                  <div className="plus-price-row">
                    <strong>{plan.price}</strong>
                    <span>{plan.period}</span>
                  </div>
                  <button
                    type="button"
                    className="plus-plan-btn"
                    onClick={() => openCheckout(plan)}
                  >
                    {plan.cta}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="panel plus-benefits-card">
            <div className="settings-section-head">
              <h2>Incluído</h2>
              <span>Benefícios</span>
            </div>
            <div className="plus-benefits-list">
              {plusBenefits.map((benefit) => (
                <div key={benefit} className="plus-benefit-item">
                  <span>
                    <Check aria-hidden="true" />
                  </span>
                  <p>{benefit}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
        )}

        {hasMembership ? (
          <section className="panel plus-benefits-card">
            <div className="settings-section-head">
              <h2>Incluído no seu plano</h2>
              <span>Benefícios</span>
            </div>
            <div className="plus-benefits-list">
              {plusBenefits.map((benefit) => (
                <div key={benefit} className="plus-benefit-item">
                  <span>
                    <Check aria-hidden="true" />
                  </span>
                  <p>{benefit}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>

      {selectedPlan ? (
        <div className="plus-checkout-backdrop" role="presentation">
          <section
            className="plus-checkout-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="plus-checkout-title"
          >
            <div className="plus-checkout-head">
              <div>
                <span>Checkout EURECA+</span>
                <h2 id="plus-checkout-title">Plano {selectedPlan.name}</h2>
              </div>
              <button
                type="button"
                className="plus-checkout-close"
                aria-label="Fechar checkout"
                onClick={closeCheckout}
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <div className="plus-checkout-summary">
              <div>
                <strong>{selectedPlan.price}</strong>
                <span>{selectedPlan.period}</span>
              </div>
              <p>{selectedPlan.summary}</p>
            </div>

            <div className="plus-payment-list">
              <span className="plus-payment-label">Forma de pagamento</span>
              {paymentMethods.map((method) => {
                const MethodIcon = method.icon;

                return (
                  <button
                    key={method.id}
                    type="button"
                    className={`plus-payment-option ${
                      selectedPaymentMethod === method.id ? "is-selected" : ""
                    }`}
                    aria-pressed={selectedPaymentMethod === method.id}
                    onClick={() => {
                      setSelectedPaymentMethod(method.id);
                      setCheckoutNotice("");
                    }}
                  >
                    <MethodIcon aria-hidden="true" />
                    <span>
                      <strong>{method.label}</strong>
                      <small>{method.detail}</small>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="plus-payment-preview">
              <SelectedPaymentIcon aria-hidden="true" />
              <div>
                <strong>{selectedPayment.label}</strong>
                <span>{selectedPayment.detail}</span>
              </div>
            </div>

            <div className="plus-checkout-secure">
              <ShieldCheck aria-hidden="true" />
              <span>
                Checkout visual preparado para integração com provedor de
                pagamentos. Nenhum dado real é capturado nesta etapa.
              </span>
            </div>

            {checkoutNotice ? (
              <p className="plus-checkout-notice">{checkoutNotice}</p>
            ) : null}

            <button
              type="button"
              className="plus-confirm-btn"
              onClick={confirmCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? "Confirmando..." : "Confirmar pagamento"}
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}

export default EurecaPlusView;
